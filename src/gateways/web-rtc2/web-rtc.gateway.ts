import {
  BadRequestException,
  forwardRef,
  Inject,
  InternalServerErrorException,
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
  Consumer,
  DtlsParameters,
  PlainTransport,
  Producer,
  ProducerOptions,
  Router,
  RtpCodecCapability,
  Transport,
  WebRtcTransport,
  Worker,
  type RtpCapabilities,
} from 'mediasoup/node/lib/types';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { IAuthFullPayload } from 'src/auth/interfaces/auth-payload.interface';
import { StreamsService } from 'src/streams/streams.service';
import FFmpeg from 'src/utils/mediasoup/classes/ffmpeg';
import GStreamer from 'src/utils/mediasoup/classes/gstreamer';
import mediasoupConfig from 'src/utils/mediasoup/config/mediasoup.config';
import {
  MediaRecordInfo,
  RecordInfo,
} from 'src/utils/mediasoup/interfaces/record-info';
import { RecordingService } from 'src/utils/recording/recording.service';
import { ChatGateway } from '../chat/chat.gateway';
import AppData from './types/app-data.type';
import { SignalingUser } from './types/signaling-user.type';
import TransportType from './types/transport.type';

// const gi = require('node-gtk')
// const Gtk = gi.require('Gtk', '3.0')

type ChannelData = {
  router: Router;
  transports: Map<
    string,
    { send?: WebRtcTransport; receive?: WebRtcTransport }
  >;
  producers: Map<string, Producer[]>;
  sockets: Map<string, SignalingUser>;
  record: {
    ongoing: boolean;
    remotePorts: number[];
    process?: FFmpeg | GStreamer;
    transports: PlainTransport[];
    consumers: Consumer[];
  };
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

  private RECORD_PROCESS_NAME = (process.env.PROCESS_NAME || 'GStreamer') as
    | 'FFmpeg'
    | 'GStreamer';
  private RECORD_VIDEO_TYPE = (process.env.VIDEO_TYPE || 'webm') as
    | 'webm'
    | 'mp4';
  private initRecordData = {
    ongoing: false,
    remotePorts: [],
    transports: [],
    consumers: [],
  };

  constructor(
    private authService: AuthService,
    @Inject(forwardRef(() => StreamsService))
    private streamsService: StreamsService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    private recordingService: RecordingService,
  ) {}
  async onModuleInit() {
    this.worker = await createWorker(mediasoupConfig.worker);
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
      isRecording: channel.record.ongoing,
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

    const transport = await channel.router.createWebRtcTransport(
      mediasoupConfig.webRtcTransport,
    );

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
    const channelSocket = channel.sockets.get(client.id);
    if (!channelSocket)
      throw new NotFoundException('Channel socket not found.');

    if (user.role !== 'TEACHER' && payload.kind == 'video')
      throw new BadRequestException('Only the Teacher can produce a video.');

    //ensure that only host can send video

    const producer = await transport.produce({
      ...payload,
      paused: (payload.appData as AppData).initiallyPaused,
    });

    //since we are currently also using the 'paused' state of the producer for muting
    // if (muted && !producer.paused)
    //   throw new BadRequestException(
    //     'Producer is not paused for a muted state.',
    //   );

    let channelProducers = channel.producers.get(client.id);
    if (!channelProducers)
      channelProducers = channel.producers.set(client.id, []).get(client.id)!;
    channelProducers.push(producer);

    if (channel.record.ongoing) {
      // setTimeout(async () => {
      //   await channel.record.process?.kill();

      //   await this.recordNewProducer(producer, channel);
      // }, 2000);
      const mediaRecordInfo = await this.publishProducerRtpStream(
        channel,
        producer,
      );
      if (mediaRecordInfo)
        (channel.record.process as GStreamer).restart(
          mediaRecordInfo,
          producer.kind,
        );
    }

    channelSocket.muted = {
      ...channelSocket.muted,
      [producer.kind]: producer.paused,
    };

    client.broadcast.to(channelId).emit('produced', {
      userId: client.id,
      producerId: producer.id,
      mute: producer.paused,
      appData: producer.appData,
    });

    console.log(
      payload.kind,
      payload.paused,
      (payload.appData as AppData).initiallyPaused,
    );

    client.broadcast.to(channelId).emit('track-mute-toggled', {
      userId: client.id,
      producerId: producer.id,
      kind: producer.kind,
      mute: producer.paused,
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

    // if (mute) producer.pause();
    // else producer.resume();

    client.broadcast.to(channelId).emit('track-mute-toggled', {
      userId: client.id,
      producerId,
      kind: producer.kind,
      mute,
    });

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

  @SubscribeMessage('start-record')
  async handleStartRecord(
    @ConnectedSocket() client: Socket,
    @MessageBody() channelId: string,
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    if (channel.record.ongoing) {
      this.logger.warn(
        `Recording already in progress for channel: ${channelId}`,
      );
      return;
    }

    this.logger.log(`Starting recording for channel: ${channelId}`);

    await this.startRecording(channelId, channel);

    this.logger.log(`Recording for channel: ${channelId} started`);

    return true;
  }

  @SubscribeMessage('stop-record')
  async handleStopRecord(
    @ConnectedSocket() client: Socket,
    @MessageBody() channelId: string,
  ) {
    const { channel } = this.validateChannelAndClientMember(
      channelId,
      client.id,
    );

    if (!channel.record.ongoing) {
      this.logger.warn(`No ongoing recording for channel: ${channelId}`);
      return;
    }

    this.stopRecording(channel);

    this.logger.log(`Recording for channel: ${channelId} stopped`);

    return true;
  }

  @SubscribeMessage('leave-channel')
  async leaveChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() id: string,
  ) {
    this.server.in(client.id).disconnectSockets(true);

    this.logger.log(`Client ${client.id} left channel ${id}.`);

    return {};
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
    const mediaCodecs: RtpCodecCapability[] = [];
    const audioMimeTypes = ['audio/opus'];
    const audioCodecs = mediasoupConfig.router.mediaCodecs.filter((c) =>
      audioMimeTypes.includes(c.mimeType),
    );
    if (audioCodecs.length == 0) {
      this.logger.error(
        `Could not get codecs matching any of: ${audioMimeTypes}`,
      );
      throw new InternalServerErrorException();
    }
    mediaCodecs.push(...audioCodecs);

    let videoMimeTypes: string[] | undefined;
    switch (this.RECORD_VIDEO_TYPE) {
      case 'webm':
        videoMimeTypes = ['video/VP8', 'video/VP9'];
        break;
      case 'mp4':
        videoMimeTypes = ['video/H264'];
        break;
    }
    const videoCodecs = mediasoupConfig.router.mediaCodecs.filter((c) =>
      videoMimeTypes.includes(c.mimeType),
    );
    if (videoCodecs.length == 0) {
      this.logger.error(
        `Could not get codecs matching any of: ${videoMimeTypes}`,
      );
      throw new InternalServerErrorException();
    }
    mediaCodecs?.push(...videoCodecs);

    const router = await this.worker.createRouter({ mediaCodecs });
    this.channels.set(id, {
      router,
      transports: new Map(),
      sockets: new Map(),
      producers: new Map(),
      record: { ...this.initRecordData },
    });
    console.log(`Channel ${id} created!`);
    // this.initChannelCloseTimeout(id);
  }
  async endStream(channelId: string) {
    const channel = this.channels.get(channelId);
    if (!channel) return;
    await this.closeChannel(channelId, channel);
  }

  getChannelInfo(channelId: string) {
    const channel = this.channels.get(channelId);
    if (!channel) {
      // ensure ended
      this.streamsService.endSession(channelId);
      return null;
    }

    const users = [...channel.sockets.values()];
    return { users };
  }

  async startRecording(channelId: string, channel: ChannelData) {
    let recordInfo: RecordInfo = {
      fileName: `${channelId}-${Date.now().toString()}`,
      audio: [],
      video: [],
    };

    for (const producer of [...channel.producers.values()].flat()) {
      const mediaRecordInfo = await this.publishProducerRtpStream(
        channel,
        producer,
      );
      if (mediaRecordInfo) recordInfo[producer.kind].push(mediaRecordInfo);
    }

    channel.record.process = this.getRecordProcess(recordInfo);

    setTimeout(async () => {
      for (const consumer of channel.record.consumers) {
        // Sometimes the consumer gets resumed before the GStreamer process has fully started
        // so wait a couple of seconds
        await consumer.resume();
        await consumer.requestKeyFrame();
      }
    }, 1000);

    channel.record.ongoing = true;
  }

  stopRecording = (channel: ChannelData) => {
    channel.record.process?.kill();
    for (const remotePort of channel.record.remotePorts)
      this.recordingService.releasePort(remotePort);
    channel.record = { ...this.initRecordData };
  };

  getRecordProcess = (recordInfo: RecordInfo) => {
    switch (this.RECORD_PROCESS_NAME) {
      case 'GStreamer':
        return new GStreamer(recordInfo);
      case 'FFmpeg':
      default:
        return new FFmpeg(recordInfo, this.RECORD_VIDEO_TYPE);
    }
  };

  private publishProducerRtpStream = async (
    channel: ChannelData,
    producer: Producer,
  ) => {
    console.log('publishProducerRtpStream()');

    // Create the mediasoup RTP Transport used to send media to the GStreamer process
    const rtpTransportConfig = mediasoupConfig.plainRtpTransport;

    // If the process is set to GStreamer set rtcpMux to false
    if (this.RECORD_PROCESS_NAME === 'GStreamer')
      rtpTransportConfig.rtcpMux = false;

    const rtpTransport =
      await channel.router.createPlainTransport(rtpTransportConfig);
    channel.record.transports.push(rtpTransport);

    // Set the receiver RTP ports
    const remoteRtpPort = await this.recordingService.getPort();
    console.log(producer.kind, remoteRtpPort);

    channel.record.remotePorts.push(remoteRtpPort);

    let remoteRtcpPort: number | undefined;
    // If rtpTransport rtcpMux is false also set the receiver RTCP ports
    if (!rtpTransportConfig.rtcpMux) {
      remoteRtcpPort = await this.recordingService.getPort();
      channel.record.remotePorts.push(remoteRtcpPort);
    }

    // Connect the mediasoup RTP transport to the ports used by GStreamer
    await rtpTransport.connect({
      ip: '127.0.0.1',
      port: remoteRtpPort,
      rtcpPort: remoteRtcpPort,
    });

    //add transport

    const codecs: RtpCodecCapability[] = [];

    // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
    const routerCodec = channel.router.rtpCapabilities.codecs?.find(
      (codec) => codec.kind === producer.kind,
    );

    if (!routerCodec) return;

    codecs.push(routerCodec);

    const rtpCapabilities = {
      codecs,
      rtcpFeedback: [],
    };

    // Start the consumer paused
    // Once the gstreamer process is ready to consume resume and send a keyframe
    const rtpConsumer = await rtpTransport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true,
    });

    channel.record.consumers.push(rtpConsumer);

    const recordInfo: MediaRecordInfo = {
      remoteRtpPort,
      remoteRtcpPort,
      localRtcpPort: rtpTransport.rtcpTuple?.localPort,
      rtpCapabilities,
      rtpParameters: rtpConsumer.rtpParameters,
    };

    return recordInfo;
  };

  recordNewProducer = async (producer: Producer, channel: ChannelData) => {
    let transport: Transport;
    if (producer.kind === 'audio') {
      transport = channel.record.transports[0];
    } else {
      transport = channel.record.transports[1];
    }

    const codecs: RtpCodecCapability[] = [];

    // Codec passed to the RTP Consumer must match the codec in the Mediasoup router rtpCapabilities
    const routerCodec = channel.router.rtpCapabilities.codecs?.find(
      (codec) => codec.kind === producer.kind,
    );

    if (!routerCodec) return;

    codecs.push(routerCodec);

    const rtpCapabilities = {
      codecs,
      rtcpFeedback: [],
    };
    const rtpConsumer = await transport.consume({
      producerId: producer.id,
      rtpCapabilities,
      paused: true,
    });

    channel.record.consumers.push(rtpConsumer);

    await rtpConsumer.resume();
    await rtpConsumer.requestKeyFrame();

    // console.log(transport, rtpConsumer);
  };

  private initChannelCloseTimeout(channelId: string) {
    const oneMinute = 1000 * 60;
    const channel = this.channels.get(channelId);
    if (!channel) return;
    channel.endTimeout = setTimeout(async () => {
      if (channel.sockets.size == 0) {
        this.closeChannel(channelId, channel);
      }
    }, oneMinute);
  }

  private async closeChannel(channelId: string, channel: ChannelData) {
    this.stopRecording(channel);
    const { endedAt, exchangeRoomId } =
      await this.streamsService.endSession(channelId);
    this.notifyStreamEnd(channelId, endedAt);
  }

  private notifyStreamEnd(channelId: string, endedAt: Date) {
    this.server.to(channelId).emit('stream-ended', endedAt);
  }

  private validateChannelAndClientMember(channelId: string, clientId: string) {
    const channel = this.channels.get(channelId);
    const user = channel?.sockets.get(clientId);
    if (!channel || !user)
      throw new NotFoundException('Channel with user not found.');
    return { channel, user };
  }
}
