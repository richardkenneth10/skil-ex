import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';

@Injectable()
export class RoomsService {
  constructor(private prisma: PrismaService) {}

  async validateExchangeRoomExistsAndUserIsInRoom(
    userId: number,
    roomId: number,
  ) {
    const room = await this.prisma.exchangeRoom.findUnique({
      where: { id: roomId },
      select: {
        id: true,
        skillMatch: { select: { receiverId: true, senderId: true } },
      },
    });
    if (!room)
      throw new NotFoundException(`Room with id '${roomId}' does not exist.`);
    const isUserInRoom =
      room.skillMatch.receiverId === userId ||
      room.skillMatch.senderId === userId;
    if (!isUserInRoom)
      throw new BadRequestException('You are not in this room.');

    return room;
  }

  async validateUserIsInStreamChannel(userId: number, channelId: string) {
    const session = await this.prisma.streamSession.findUnique({
      where: { channelId, OR: [{ teacherId: userId }, { learnerId: userId }] },
    });
    if (!session)
      throw new NotFoundException(
        `Stream session with channel id '${channelId}' having user with id '${userId}' does not exist.`,
      );

    return session.teacherId === userId ? 'TEACHER' : 'LEARNER';
  }
}
