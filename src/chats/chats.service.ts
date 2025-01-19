import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { RoomsService } from 'src/rooms/rooms.service';
import { miniUserSelect } from 'src/utils/db/constants/mini-user-select.constant';
import { StringsService } from 'src/utils/strings/strings.service';
import { AddExchangeRoomMessageDto } from './dtos/add-exchange-room-message.dto';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto';

@Injectable()
export class ChatsService {
  constructor(
    private prisma: PrismaService,
    private stringsService: StringsService,
    private roomsService: RoomsService,
  ) {}

  async getExchangeRoomMessages(
    userId: number,
    roomId: number,
    { limit, cursorId, includeSkillMatch }: GetMessagesQueryDto,
  ) {
    const room = await this.prisma.exchangeRoom.findUnique({
      where: { id: roomId },
      select: {
        skillMatch: {
          select: {
            receiverSkill: { select: { name: true } },
            senderSkill: { select: { name: true } },
            receiverId: true,
            senderId: true,
            ...(includeSkillMatch && {
              sender: { select: miniUserSelect },
              receiver: { select: miniUserSelect },
            }),
          },
        },
        chatMessages: {
          include: { sender: { select: miniUserSelect } },
          orderBy: { createdAt: 'desc' },
          take: limit,
          ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
        },
      },
    });
    if (!room)
      throw new NotFoundException(`Room with id '${roomId}' does not exist.`);
    const userIsMatchSender = room.skillMatch.senderId === userId;
    const userIsMatchReceiver = room.skillMatch.receiverId === userId;
    const isUserInRoom = userIsMatchReceiver || userIsMatchSender;
    if (!isUserInRoom)
      throw new BadRequestException('You are not in this room.');

    const otherUser = userIsMatchReceiver
      ? room.skillMatch.sender
      : room.skillMatch.receiver;

    return {
      ...(includeSkillMatch && {
        skillMatch: {
          userSkill: userIsMatchReceiver
            ? room.skillMatch.receiverSkill
            : room.skillMatch.senderSkill,
          otherUserSkill: userIsMatchReceiver
            ? room.skillMatch.senderSkill
            : room.skillMatch.receiverSkill,
          otherUser: {
            id: otherUser.id,
            name: this.stringsService.generateFullName(
              otherUser.firstName,
              otherUser.lastName,
            ),
            bio: otherUser.bio,
            avatarUrl: otherUser.avatarUrl,
          },
        },
      }),
      messages: room.chatMessages.map((m) => ({
        ...m,
        sender: {
          id: m.sender.id,
          name: this.stringsService.generateFullName(
            m.sender.firstName,
            m.sender.lastName,
          ),
          bio: m.sender.bio,
          avatarUrl: m.sender.avatarUrl,
        },
      })),
    };
  }

  async addExchangeRoomMessage(
    userId: number,
    roomId: number,
    { content }: AddExchangeRoomMessageDto,
  ) {
    const room =
      await this.roomsService.validateExchangeRoomExistsAndUserIsInRoom(
        userId,
        roomId,
      );

    const newMessage = await this.prisma.chatMessage.create({
      data: {
        senderId: userId,
        content,
        exchangeRoomId: room.id,
      },
    });

    return newMessage;
  }
}
