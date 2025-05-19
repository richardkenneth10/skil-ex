import {
  Injectable,
  Logger,
  ParseIntPipe,
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
import { ChatMessage } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { IAuthFullPayload } from 'src/auth/interfaces/auth-payload.interface';
import { ChatsService } from 'src/chats/chats.service';
import { AddExchangeRoomMessageExtendedDto } from 'src/chats/dtos/add-exchange-room-message.dto';
import { RoomsService } from 'src/rooms/rooms.service';

@WebSocketGateway({ namespace: 'chat' })
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
@Injectable()
// @UseGuards(WSAuthGuard)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  constructor(
    private authService: AuthService,
    private chatsService: ChatsService,
    private roomsService: RoomsService,
  ) {}

  private logger = new Logger('ChatGateway');

  @WebSocketServer()
  server: Server;

  @SubscribeMessage('join-exchange-room-chat')
  async handleJoinExchangeRoomChat(
    @ConnectedSocket() socket: Socket,
    @MessageBody(ParseIntPipe) roomId: number,
  ) {
    const { ongoingStreamSession } =
      await this.roomsService.validateExchangeRoomExistsAndUserIsInRoom(
        ((socket.request as any).auth as IAuthFullPayload).sub,
        roomId,
        { includeOngoingSSession: true },
      );

    await socket.join(roomId.toString());
    console.log(`Socket ${socket.id} joined exchange room chat: ${roomId}`);

    console.log(ongoingStreamSession);

    return { ongoingStreamSession }; //note, it can never be undefined
  }

  @SubscribeMessage('send-exchange-room-chat-message')
  async handleSendExchangeRoomMessage(
    @ConnectedSocket() socket: Socket,
    @MessageBody() { roomId, content }: AddExchangeRoomMessageExtendedDto,
  ): Promise<any> {
    const userId = ((socket.request as any).auth as IAuthFullPayload).sub;
    await this.roomsService.validateExchangeRoomExistsAndUserIsInRoom(
      userId,
      roomId,
    );
    const newMessage = await this.chatsService.addExchangeRoomMessage(
      userId,
      roomId,
      { content },
    );

    this.notifyNewMessage(newMessage, roomId);

    return newMessage;
  }

  notifyNewMessage(message: ChatMessage, roomId: number) {
    this.server
      .to(roomId.toString())
      .emit('receive-exchange-room-chat-message', message);
  }

  notifyStreamStart(roomId: string, channelId: string) {
    this.server.to(roomId).emit('stream-started', channelId);
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

  handleDisconnect(socket: Socket) {
    this.logger.log(`Socket disconnected: ${socket.id}`);
  }
}
