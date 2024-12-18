import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { UsersService } from 'src/users/users.service';
import { DbService } from 'src/utils/db/db.service';
import { PaginationDataDto } from 'src/utils/validators/dtos/pagination-data.dto';
import { AddExchangeRoomResourceDto } from './dtos/add-exchange-room-resource.dto';
import { miniUserSelect } from 'src/utils/db/constants/mini-user-select.constant';

@Injectable()
export class ResourcesService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private dbUtils: DbService,
  ) {}

  async getExchangeRoomResources(
    userId: number,
    skillMatchId: number,
    { page, limit }: PaginationDataDto,
  ) {
    const skillMatch = await this.prisma.skillMatch.findUnique({
      where: { id: skillMatchId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: {
        receiverId: true,
        senderId: true,
        exchangeRoom: {
          select: {
            resources: {
              include: { uploadedBy: { select: miniUserSelect } },
              orderBy: { createdAt: 'desc' },
              skip: (page - 1) * limit,
              take: limit,
            },
          },
        },
      },
    });

    if (!skillMatch)
      throw new NotFoundException(
        `Confirmed or Completed SkillMatch with id '${skillMatchId}' does not exist.`,
      );
    const isUserInRoom =
      skillMatch.receiverId === userId || skillMatch.senderId === userId;
    if (!isUserInRoom)
      throw new BadRequestException('You are not in the room of this match.');

    return skillMatch.exchangeRoom!.resources;
  }

  async addExchangeRoomResource(
    userId: number,
    skillMatchId: number,
    { content }: AddExchangeRoomResourceDto,
  ) {
    const skillMatch = await this.prisma.skillMatch.findUnique({
      where: { id: skillMatchId, status: { in: ['CONFIRMED', 'COMPLETED'] } },
      select: {
        receiverId: true,
        senderId: true,
        exchangeRoom: { select: { id: true } },
      },
    });

    if (!skillMatch)
      throw new NotFoundException(
        `Confirmed or Completed SkillMatch with id '${skillMatchId}' does not exist.`,
      );
    const isUserInRoom =
      skillMatch.receiverId === userId || skillMatch.senderId === userId;
    if (!isUserInRoom)
      throw new BadRequestException('You are not in the room of this match.');

    const newMessage = await this.prisma.resource.create({
      data: {
        uploadedById: userId,
        url: content,
        exchangeRoomId: skillMatch.exchangeRoom!.id,
      },
    });

    return newMessage;
  }
}
