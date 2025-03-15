import {
  BadRequestException,
  forwardRef,
  Inject,
  Logger,
  NotFoundException,
  OnModuleInit,
  UnprocessableEntityException,
  UseFilters,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  BaseWsExceptionFilter,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import { createWorker } from 'mediasoup';
import {
  DtlsParameters,
  Producer,
  ProducerOptions,
  Router,
  WebRtcTransport,
  Worker,
  type RtpCapabilities,
} from 'mediasoup/node/lib/types';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { IAuthFullPayload } from 'src/auth/interfaces/auth-payload.interface';
import { StreamsService } from 'src/streams/streams.service';
import { ChatGateway } from '../chat/chat.gateway';
import AppData from './types/app-data.type';
import { SignalingUser } from './types/signaling-user.type';
import TransportType from './types/transport.type';

type ChannelData = {
  router: Router;
  transports: Map<
    string,
    { send?: WebRtcTransport; receive?: WebRtcTransport }
  >;
  producers: Map<string, Producer[]>;
  sockets: Map<string, SignalingUser>;
  endTimeout?: NodeJS.Timeout;
};
@WebSocketGateway({ namespace: 'signaling2' })
// @WebSocketGateway({
//   cors: {
//     origin: '*', // Update to your allowed origin(s)
//     credentials: true,
//   },
// })
@UseFilters(BaseWsExceptionFilter)
@UsePipes(
  new ValidationPipe({
    exceptionFactory: (errors) => errors.map((e) => new WsException(e)),
  }),
)
export class WebRTCGateway2
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit
{
  private logger = new Logger('WebRTC2Gateway');
  @WebSocketServer()
  private server: Server;
  private channels = new Map<string, ChannelData>();
  private worker: Worker;
  private activeSocketsToChannels = new Map<string, string[]>();

  constructor(
    private authService: AuthService,
    @Inject(forwardRef(() => StreamsService))
    private streamsService: StreamsService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) {}
  async onModuleInit() {
    this.worker = await createWorker();
    console.log('Media soup worker created!');
  }

  @SubscribeMessage('join-channel')
  async joinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() id: string,
  ) {
    const user = await this.streamsService.validateUserIsInOngoingStreamChannel(
      ((client.request as any).auth as IAuthFullPayload).sub,
      id,
    );

    let channel = this.channels.get(id);

    if (!channel) throw new NotFoundException('Channel not found.');

    //ensure that an existing socket of this user is not here
    const channelSockets = [...channel.sockets];
    const channelSocket = channelSockets.find(
      (s) => s[1].user.id == user.user.id,
    );
    if (channelSocket) {
      this.server.in(channelSocket[0]).disconnectSockets(true);
    }

    client.join(id);

    const existingSocketInChannel = channel.sockets.get(client.id);
    if (!existingSocketInChannel) {
      client.emit(`update-user-list`, {
        users: channelSockets
          //remove cases where user joined more than once
          .filter((s) => s[1].user.id !== user.user.id)
          .map(([id, user]) => ({
            id,
            ...user,
          })),
        current: { id: client.id, ...user },
      });
      channel.sockets.set(client.id, user);

      if (channel.endTimeout) {
        clearTimeout(channel.endTimeout);
        channel.endTimeout = undefined;
      }

      console.log(client.id, user);

      client.broadcast.to(id).emit(`add-user`, {
        user: { id: client.id, ...user },
      });
    }
    const existingSocketChannels = this.activeSocketsToChannels.get(client.id);
    if (!existingSocketChannels) {
      this.activeSocketsToChannels.set(client.id, [id]);
    } else {
      const existingChannel = existingSocketChannels.find(
        (channelId) => channelId === id,
      );
      if (!existingChannel) {
        existingSocketChannels.push(id);
      }
    }
    this.logger.log(`Client ${client.id} joined channel ${id} as ${user.role}`);

    return {
      role: user.role,
      routerRtpCapabilities: channel.router.rtpCapabilities,
    };
  }

  @SubscribeMessage('create-transport')
  async handleCreateTransport(
    @ConnectedSocket() client: Socket,
    //you want to do validation
    @MessageBody()
    [type, channelId]: [TransportType, string],
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    const transport = await channel.router.createWebRtcTransport({
      listenIps: [{ ip: '127.0.0.1', announcedIp: '127.0.0.1' }],
      enableUdp: true,
      enableTcp: true,
    });

    console.log(type, channelId, transport.id);

    let channelTransports = channel.transports.get(client.id);
    if (!channelTransports)
      channelTransports = channel.transports.set(client.id, {}).get(client.id)!;

    switch (type) {
      case 'send':
        channelTransports.send = transport;
        break;
      case 'receive':
        channelTransports.receive = transport;
        break;
    }

    console.log('done');

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  @SubscribeMessage('connect-transport')
  async handleConnectTransport(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    [type, { dtlsParameters }, channelId]: [
      TransportType,
      { dtlsParameters: DtlsParameters },
      string,
    ],
  ) {
    console.log(channelId, 'conne');

    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );
    console.log('conn');

    const transport = channel.transports.get(client.id)?.[type];
    if (!transport) throw new NotFoundException('Transport not found.');
    await transport.connect({ dtlsParameters });

    this.logger.log(
      `Client with id: ${client.id} in channel ${channelId} transport connected`,
    );
    return {}; //as acknowledgement
  }

  @SubscribeMessage('produce')
  async handleProduce(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    [payload, channelId]: [ProducerOptions, string],
  ) {
    console.log('prod', client.id);
    console.log(channelId, 'in prod');

    const { channel, user } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    const transport = channel.transports.get(client.id)?.send;
    if (!transport) throw new NotFoundException('Transport not found.');

    if (user.role !== 'TEACHER' && payload.kind == 'video')
      throw new BadRequestException('Only the Teacher can produce a video');

    //ensure that only host can send video

    const producer = await transport.produce(payload);

    let channelProducers = channel.producers.get(client.id);
    if (!channelProducers)
      channelProducers = channel.producers.set(client.id, []).get(client.id)!;
    channelProducers.push(producer);

    client.broadcast.to(channelId).emit('produced', {
      userId: client.id,
      producerId: producer.id,
      mute: producer.paused,
      appData: producer.appData,
    });

    this.logger.log(
      `Client with id: ${client.id} in channel ${channelId} produced ${producer.id}`,
    );

    return { id: producer.id };
  }

  @SubscribeMessage('consume')
  async handleConsume(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    [payload, channelId]: [
      {
        producerId: string;
        rtpCapabilities: RtpCapabilities;
        appData: AppData;
      },
      string,
    ],
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    if (!channel.router.canConsume(payload))
      throw new UnprocessableEntityException(`Cannot consume.`);

    const transport = channel.transports.get(client.id)?.receive;
    if (!transport) throw new NotFoundException('Transport not found.');

    const consumer = await transport.consume({ ...payload, paused: true });
    const { id, kind, rtpParameters, appData } = consumer;
    consumer.resume();
    //ensure that only host can send video
    //later look into muting func and emitting events on mute

    return { id, producerId: payload.producerId, kind, rtpParameters, appData };
  }

  @SubscribeMessage('send-produced')
  async handleSendProduced(
    @ConnectedSocket() client: Socket,
    @MessageBody() channelId: string,
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    [...channel.producers].forEach(([userId, userProducers]) => {
      if (userId === client.id) return;
      userProducers.forEach((producer) => {
        client.emit('produced', {
          userId,
          producerId: producer.id,
          mute: producer.paused,
          appData: producer.appData,
        });
      });
    });
  }

  @SubscribeMessage('mute')
  async handleMute(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    [{ producerId, mute }, channelId]: [
      { producerId: string; mute: boolean },
      string,
    ],
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    const producer = channel.producers
      .get(client.id)
      ?.find((p) => p.id === producerId);
    if (!producer) throw new NotFoundException('Producer not found.');

    if (mute) producer.pause();
    else producer.resume();

    client.broadcast
      .to(channelId)
      .emit('track-mute-toggled', { userId: client.id, producerId, mute });

    return true; //acknowledgement
  }

  @SubscribeMessage('screen-share')
  async handleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    [{ producerId, shared }, channelId]: [
      { producerId: string; shared: boolean },
      string,
    ],
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    const producer = channel.producers
      .get(client.id)
      ?.find((p) => p.id === producerId);
    if (!producer) throw new NotFoundException('Producer not found.');
    if ((producer.appData as AppData).mediaTag !== 'screen')
      throw new BadRequestException('Producer is not screen.');

    if (!shared) {
      producer.close();
      channel.producers.delete(producer.id);
    }

    client.broadcast
      .to(channelId)
      .emit('screen-share-toggled', { userId: client.id, producerId, shared });

    return true; //acknowledgement
  }

  @SubscribeMessage('send-message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    [{ content }, channelId]: [{ content: string }, string],
  ) {
    const { user } = this.validateChannelAndClientMember(channelId, client.id);
    console.log(content);

    //validate message
    this.server
      .to(channelId)
      .emit('receive-message', { user: { id: client.id, ...user }, content });

    return true; //acknowledgement
  }

  async handleConnection(socket: Socket) {
    try {
      await this.authService.authenticateWebSocketClient(socket);
    } catch (error) {
      socket.disconnect(true);
      return;
    }
    this.logger.log(`Socket connected: ${socket.id}`);
  }

  async handleDisconnect(client: Socket) {
    //allow any ongoing promises to resolve first
    setTimeout(() => {
      const socketChannels = this.activeSocketsToChannels.get(client.id);
      console.log(socketChannels);

      if (socketChannels) {
        for (const c of socketChannels) {
          const channel = this.channels.get(c);
          channel?.sockets.delete(client.id);
          channel?.transports.delete(client.id);
          channel?.producers.delete(client.id);
          client.broadcast.to(c).emit(`remove-user`, {
            socketId: client.id,
          });
          if (channel?.sockets.size == 0) {
            this.initChannelCloseTimeout(c);
          }
        }
      }
      this.activeSocketsToChannels.delete(client.id);
      this.logger.log(`Client disconnected: ${client.id}`);
    }, 0);
  }

  async setupChannel(id: string) {
    const router = await this.worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2,
        },
        { kind: 'video', mimeType: 'video/VP8', clockRate: 90000 },
      ],
    });
    this.channels.set(id, {
      router,
      transports: new Map(),
      sockets: new Map(),
      producers: new Map(),
    });
    console.log(`Channel ${id} created!`);
    // this.initChannelCloseTimeout(id);
  }

  getChannelInfo(channelId: string) {
    const channel = this.channels.get(channelId);
    if (!channel) return null;

    const users = [...channel.sockets.values()];
    return { users };
  }

  private initChannelCloseTimeout(channelId: string) {
    const oneMinute = 1000 * 60;
    const channel = this.channels.get(channelId);
    if (!channel) return;
    channel.endTimeout = setTimeout(async () => {
      if (channel.sockets.size == 0) {
        const { endedAt, exchangeRoomId } =
          await this.streamsService.endLive(channelId);
        this.chatGateway.notifyStreamEnd(
          exchangeRoomId.toString(),
          channelId,
          endedAt,
        );
      }
    }, oneMinute);
  }

  private validateChannelAndClientMember(channelId: string, clientId: string) {
    const channel = this.channels.get(channelId);
    const user = channel?.sockets.get(clientId);
    if (!channel || !user)
      throw new NotFoundException('Channel with user not found.');
    return { channel, user };
  }
}
