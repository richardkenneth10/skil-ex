import {
  BadRequestException,
  Logger,
  NotFoundException,
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
import { RoomsService } from 'src/rooms/rooms.service';
import AppData from './types/app-data.type';
import TransportType from './types/transport.type';
import UserSignalingRole from './types/user-signaling-role.type';

type ChannelData = {
  router: Router;
  transports: Map<
    string,
    { send?: WebRtcTransport; receive?: WebRtcTransport }
  >;
  producers: Map<string, Producer[]>;
  sockets: Map<string, UserSignalingRole>;
};
@WebSocketGateway({ namespace: 'signaling2' })
@UseFilters(BaseWsExceptionFilter)
@UsePipes(
  new ValidationPipe({
    exceptionFactory: (errors) => errors.map((e) => new WsException(e)),
  }),
)
export class WebRTCGateway2
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private logger = new Logger('WebRTC2Gateway');
  @WebSocketServer()
  private server: Server;

  private channels = new Map<string, ChannelData>();
  private worker: Worker;
  private activeSocketsToChannels = new Map<
    string,
    { id: string; role: UserSignalingRole }[]
  >();

  constructor(
    private authService: AuthService,
    private roomsService: RoomsService,
  ) {
    this.init();
  }

  async init() {
    this.worker = await createWorker();

    console.log('Media soup worker created!');
  }

  @SubscribeMessage('join-channel')
  async joinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() id: string,
  ) {
    const role = await this.roomsService.validateUserIsInStreamChannel(
      ((client.request as any).auth as IAuthFullPayload).sub,
      id,
    );

    let channel = this.channels.get(id);
    if (!channel) {
      switch (role) {
        case 'TEACHER':
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
          channel = this.channels
            .set(id, {
              router,
              transports: new Map(),
              sockets: new Map(),
              producers: new Map(),
            })
            .get(id)!;
          console.log(`Channel ${id} created!`);

          break;
        case 'LEARNER':
          throw new NotFoundException('Channel not found.');
      }
    }

    client.join(id);

    const existingSocketInChannel = channel.sockets.get(client.id);
    if (!existingSocketInChannel) {
      client.emit(`update-user-list`, {
        users: [...channel.sockets].map(([id, role]) => ({ id, role })),
        current: { id: client.id, role },
      });
      channel.sockets.set(client.id, role);

      client.broadcast.to(id).emit(`add-user`, {
        user: { id: client.id, role },
      });
    }
    const existingSocketChannels = this.activeSocketsToChannels.get(client.id);
    if (!existingSocketChannels) {
      this.activeSocketsToChannels.set(client.id, [{ id, role }]);
    } else {
      const existingChannel = existingSocketChannels.find(
        (channel) => channel.id === id,
      );
      if (!existingChannel) {
        existingSocketChannels.push({ id, role });
      }
    }
    this.logger.log(`Client ${client.id} joined channel ${id} as ${role}`);

    return channel.router.rtpCapabilities;
  }

  @SubscribeMessage('create-transport')
  async handleCreateTransport(
    @ConnectedSocket() client: Socket,
    //you want to do validation
    @MessageBody()
    [type, channelId]: [TransportType, string],
  ) {
    const channel = this.validateChannelAndClientMember(channelId, client.id);

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

    const channel = this.validateChannelAndClientMember(channelId, client.id);
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

    const channel = this.validateChannelAndClientMember(channelId, client.id);

    const transport = channel.transports.get(client.id)?.send;
    if (!transport) throw new NotFoundException('Transport not found.');

    //ensure that only host can send video
    //later look into muting func and emitting events on mute

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
    const channel = this.validateChannelAndClientMember(channelId, client.id);

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
    const channel = this.validateChannelAndClientMember(channelId, client.id);

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
    const channel = this.validateChannelAndClientMember(channelId, client.id);

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
    const channel = this.validateChannelAndClientMember(channelId, client.id);

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

  async handleConnection(socket: Socket) {
    try {
      await this.authService.authenticateWebSocketClient(socket);
    } catch (error) {
      socket.disconnect(true);
      return;
    }
    this.logger.log(`Socket connected: ${socket.id}`);
  }

  handleDisconnect(client: Socket) {
    const socketChannels = this.activeSocketsToChannels.get(client.id);
    if (socketChannels) {
      socketChannels.forEach((c) => {
        const channel = this.channels.get(c.id);
        channel?.sockets.delete(client.id);
        channel?.transports.delete(client.id);
        channel?.producers.delete(client.id);
        client.broadcast.to(c.id).emit(`remove-user`, {
          socketId: client.id,
        });
      });
      this.activeSocketsToChannels.delete(client.id);
    }
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  private validateChannelAndClientMember(channelId: string, clientId: string) {
    const channel = this.channels.get(channelId);
    if (!channel || !channel.sockets.has(clientId))
      throw new NotFoundException('Channel with user not found.');
    return channel;
  }
}
