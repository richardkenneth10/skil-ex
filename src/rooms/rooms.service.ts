import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { ChatGateway } from 'src/gateways/chat/chat.gateway';
import { WebRTCGateway2 } from 'src/gateways/web-rtc2/web-rtc.gateway';
import { liveMessageInclude } from 'src/utils/db/constants/live-message-include.constant';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
    @Inject(forwardRef(() => WebRTCGateway2))
    private webRTCGateway: WebRTCGateway2,
  ) {}

  async goLive(userId: number, roomId: number) {
    const room = await this.validateExchangeRoomExistsAndUserIsInRoom(
      userId,
      roomId,
    );

    let ongoingSession = await this.prisma.streamSession.findFirst({
      where: {
        exchangeRoomId: roomId,
        OR: [{ teacherId: userId }, { learnerId: userId }],
        endedAt: null,
      },
    });
    if (ongoingSession)
      throw new ConflictException('There is an ongoing session in this room.');

    const otherUserId =
      room.skillMatch.receiverId === userId
        ? room.skillMatch.senderId
        : room.skillMatch.receiverId;
    const newSession = await this.prisma.streamSession.create({
      data: {
        exchangeRoomId: roomId,
        teacherId: userId,
        learnerId: otherUserId,
      },
    });

    const newMessage = await this.prisma.chatMessage.create({
      data: {
        exchangeRoomId: room.id,
        type: 'LIVE',
        senderId: userId,
        liveMessage: {
          create: { channelId: newSession.channelId, sessionId: newSession.id },
        },
      },
      include: {
        liveMessage: {
          include: liveMessageInclude,
        },
      },
    });

    await this.webRTCGateway.setupChannel(newSession.channelId);

    this.chatGateway.notifyNewMessage(newMessage, room.id);

    this.chatGateway.notifyStreamStart(
      room.id.toString(),
      newSession.channelId,
    );

    return { channelId: newSession.channelId };
  }

  async joinLive(userId: number, roomId: number) {
    const session = await this.prisma.streamSession.findFirst({
      where: {
        learnerId: userId,
        exchangeRoomId: roomId,
      },
    });
    if (!session)
      throw new NotFoundException(`No ongoing stream session to join in room.`);

    return { channelId: session.channelId };
  }

  async validateExchangeRoomExistsAndUserIsInRoom(
    userId: number,
    roomId: number,
    options?: { includeOngoingSSession: boolean },
  ) {
    const room = await this.prisma.exchangeRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        skillMatch: { select: { receiverId: true, senderId: true } },
        streamSessions: options?.includeOngoingSSession && {
          where: { endedAt: null },
          take: 1,
          select: { channelId: true },
        },
      },
    });
    if (!room)
      throw new NotFoundException(`Room with id '${roomId}' does not exist.`);
    const isUserInRoom =
      room.skillMatch.receiverId === userId ||
      room.skillMatch.senderId === userId;
    if (!isUserInRoom)
      throw new BadRequestException('You are not in this room.');

    return {
      ...room,
      streamSessions: undefined,
      ...(options?.includeOngoingSSession && {
        ongoingStreamSession:
          room.streamSessions.length == 0
            ? null
            : { channelId: room.streamSessions[0].channelId },
      }),
    };
  }
}
