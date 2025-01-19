import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { UsersService } from 'src/users/users.service';
import { miniUserSelect } from 'src/utils/db/constants/mini-user-select.constant';
import { DbService } from 'src/utils/db/db.service';
import { PaginationDto } from 'src/utils/validators/dtos/pagination.dto';
import { AddExchangeRoomResourceDto } from './dtos/add-exchange-room-resource.dto';

@Injectable()
export class ResourcesService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private dbUtils: DbService,
  ) {}

  async getExchangeRoomResources(
    userId: number,
    roomId: number,
    { limit, cursorId }: PaginationDto,
  ) {
    const room = await this.prisma.exchangeRoom.findUnique({
      where: { id: roomId },
      select: {
        skillMatch: { select: { receiverId: true, senderId: true } },
        resources: {
          include: { uploadedBy: { select: miniUserSelect } },
          orderBy: { createdAt: 'desc' },
          take: limit,
          ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
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

    return room.resources;
  }

  async addExchangeRoomResource(
    userId: number,
    roomId: number,
    { content }: AddExchangeRoomResourceDto,
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

    const newResource = await this.prisma.resource.create({
      data: {
        uploadedById: userId,
        url: content,
        exchangeRoomId: room.id,
      },
    });

    return newResource;
  }
}
