import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { IAuthFullPayload } from 'src/auth/interfaces/auth-payload.interface';
import { StreamsService } from 'src/streams/streams.service';
import UserSignalingRole from './types/user-signaling-role.type';

@WebSocketGateway({ namespace: 'signaling' })
export class WebRTCGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  constructor(
    private authService: AuthService,
    private streamsService: StreamsService,
  ) {}

  private activeSockets: {
    channel: string;
    id: string;
    role: UserSignalingRole;
  }[] = [];
  private logger = new Logger('WebRTCGateway');

  afterInit(server: any) {
    this.logger.log('Init');
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
    const existingSocket = this.activeSockets.find((s) => s.id === client.id);
    if (!existingSocket) return;
    this.activeSockets = this.activeSockets.filter((s) => s.id !== client.id);
    client.broadcast.emit(`${existingSocket.channel}-remove-user`, {
      socketId: client.id,
    });
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-channel')
  async joinChannel(
    @ConnectedSocket() client: Socket,
    @MessageBody() id: string,
  ) {
    const { role } =
      await this.streamsService.validateUserIsInOngoingStreamChannel(
        ((client.request as any).auth as IAuthFullPayload).sub,
        id,
      );

    const existingSocketInRomm = this.activeSockets.find(
      (s) => s.channel === id && s.id === client.id,
    );
    if (!existingSocketInRomm) {
      this.activeSockets.push({ id: client.id, channel: id, role });
      client.emit(`${id}-update-user-list`, {
        users: this.activeSockets
          .filter((s) => s.channel === id && s.id !== client.id)
          .map((s) => ({ id: s.id, role: s.role })),
        current: { id: client.id, role },
      });

      client.broadcast.emit(`${id}-add-user`, {
        user: { id: client.id, role },
      });
    }
    return this.logger.log(
      `Client ${client.id} joined channel ${id} as ${role}`,
    );
  }

  @SubscribeMessage('call-user')
  callUser(
    client: Socket,
    data: { to: string; offer: RTCSessionDescriptionInit },
  ) {
    client.to(data.to).emit('call-made', {
      offer: data.offer,
      socket: client.id,
    });
  }

  @SubscribeMessage('make-answer')
  makeAnswer(
    client: Socket,
    data: { to: string; answer: RTCSessionDescriptionInit },
  ) {
    client.to(data.to).emit('answer-made', {
      answer: data.answer,
      socket: client.id,
    });
  }

  @SubscribeMessage('reject-call')
  rejectCall(client: Socket, data: { to: string }) {
    client.to(data.to).emit('call-rejected', {
      socket: client.id,
    });
  }
}
