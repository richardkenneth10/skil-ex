import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Category, MatchStatus, Skill, User } from '@prisma/client';
import { PrismaService } from 'src/db/prisma.service';
import {
  miniSkillSelect,
  miniSkillSelectWTCategory,
} from 'src/utils/db/constants/mini-skill-select.constant';
import { miniUserSelect } from 'src/utils/db/constants/mini-user-select.constant';
import { DbService } from 'src/utils/db/db.service';
import { StringsService } from 'src/utils/strings/strings.service';
import { AddCategoryDto } from './dtos/add-category.dto';
import { AddSkillMatchDto } from './dtos/add-skill-match.dto';
import { AddSkillDto } from './dtos/add-skill.dto';
import { GetSkillMatchQueryDto } from './dtos/get-skill-match-query.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { UpdateSkillDto } from './dtos/update-skill.dto';
import { IMatchWithoutCategory } from './interfaces/match-without-category.interface';
import { IMatch } from './interfaces/match.interface';

@Injectable()
export class SkillsService {
  constructor(
    private prisma: PrismaService,
    private dbUtils: DbService,
    private stringsService: StringsService,
  ) {}

  async getSkillsByCategories() {
    const skillsByCategories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        skills: { select: { id: true, name: true } },
      },
    });
    return { categories: skillsByCategories };
  }

  async addSkill(data: AddSkillDto) {
    await this.dbUtils.validateRecordExists<Category>(
      'category',
      data.categoryId,
    );
    await this.dbUtils.validateNoRecordWithValuesExists<Skill>('skill', {
      name: data.name,
      categoryId: data.categoryId,
    });

    const skill = await this.prisma.skill.create({ data });
    return skill;
  }

  async updateSkill(id: number, data: UpdateSkillDto) {
    const existingSkill = await this.dbUtils.validateRecordExists<Skill>(
      'skill',
      id,
      { returnRecord: true },
    );
    this.dbUtils.validateChangeExists(existingSkill, data);
    await this.dbUtils.validateRecordExists<Category>(
      'category',
      data.categoryId,
    );
    await this.dbUtils.validateNoRecordWithValuesExists<Skill>(
      'skill',
      { name: data.name, categoryId: data.categoryId },
      { idToExclude: id },
    );

    const skill = await this.prisma.skill.update({
      where: { id },
      data,
    });
    return skill;
  }

  async addCategory(data: AddCategoryDto) {
    await this.dbUtils.validateNoRecordWithValuesExists<Category>('category', {
      name: data.name,
    });
    const category = await this.prisma.category.create({ data });
    return category;
  }

  async updateCategory(id: number, data: UpdateCategoryDto) {
    const existingCategory = await this.dbUtils.validateRecordExists<Category>(
      'category',
      id,
      { returnRecord: true },
    );
    this.dbUtils.validateChangeExists(existingCategory, data);
    await this.dbUtils.validateNoRecordWithValuesExists<Category>(
      'category',
      { name: data.name },
      { idToExclude: id },
    );

    const category = await this.prisma.category.update({
      where: { id },
      data,
    });
    return category;
  }

  async getUserMatches(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { skillsOffered: true, skillsWanted: true },
    });
    if (!user)
      throw new NotFoundException(`User with id '${userId}' does not exist.`);

    const userSkillsSelect = {
      skill: {
        select: {
          ...miniSkillSelectWTCategory,
          receiverSkillMatches: {
            where: {
              receiverId: userId,
              status: { in: ['PENDING', 'CONFIRMED'] as MatchStatus[] },
            },
            select: { senderSkillId: true, id: true, status: true },
          },
          senderSkillMatches: {
            where: {
              senderId: userId,
              status: { in: ['PENDING', 'CONFIRMED'] as MatchStatus[] },
            },
            select: { receiverSkillId: true, id: true, status: true },
          },
        },
      },
    };
    const skillIdsWanted = user.skillsWanted.map(({ skillId }) => skillId);
    const skillIdsOffered = user.skillsOffered.map(({ skillId }) => skillId);
    const users = await this.prisma.user.findMany({
      where: {
        id: { not: userId },
        skillsOffered: {
          some: {
            skillId: { in: skillIdsWanted },
          },
        },
        skillsWanted: {
          some: {
            skillId: { in: skillIdsOffered },
          },
        },
      },
      select: {
        ...miniUserSelect,
        skillsOffered: {
          where: {
            canMatch: true,
            skillId: { in: skillIdsWanted },
          },
          select: userSkillsSelect,
        },
        skillsWanted: {
          where: {
            canMatch: true,
            skillId: { in: skillIdsOffered },
          },
          select: userSkillsSelect,
        },
      },
    });

    // Logger.verbose(users);
    const results: IMatchWithoutCategory[] = [];
    users.forEach((user) =>
      user.skillsOffered.forEach((wantedSkill) =>
        user.skillsWanted.forEach((offeredSkill) => {
          const matchWhereUserIsReceiverFromWantedSkill =
            offeredSkill.skill.receiverSkillMatches.find(
              (m) => m.senderSkillId == wantedSkill.skill.id,
            );
          const matchWhereUserIsReceiverFromOfferedSkill =
            wantedSkill.skill.receiverSkillMatches.find(
              (m) => m.senderSkillId == offeredSkill.skill.id,
            );
          const matchWhereUserIsSenderFromWantedSkill =
            offeredSkill.skill.senderSkillMatches.find(
              (m) => m.receiverSkillId == wantedSkill.skill.id,
            );
          const matchWhereUserIsSenderFromOfferedSkill =
            wantedSkill.skill.senderSkillMatches.find(
              (m) => m.receiverSkillId == offeredSkill.skill.id,
            );
          const confirmedMatchExistsBetween =
            matchWhereUserIsReceiverFromWantedSkill?.status === 'CONFIRMED' ||
            matchWhereUserIsSenderFromWantedSkill?.status === 'CONFIRMED' ||
            matchWhereUserIsReceiverFromOfferedSkill?.status === 'CONFIRMED' ||
            matchWhereUserIsSenderFromOfferedSkill?.status === 'CONFIRMED';

          if (!confirmedMatchExistsBetween) {
            const pendingMatchExistsBetween =
              matchWhereUserIsReceiverFromWantedSkill?.senderSkillId ===
                wantedSkill.skill.id ||
              matchWhereUserIsSenderFromWantedSkill?.receiverSkillId ===
                wantedSkill.skill.id ||
              matchWhereUserIsReceiverFromOfferedSkill?.senderSkillId ===
                offeredSkill.skill.id ||
              matchWhereUserIsSenderFromOfferedSkill?.receiverSkillId ===
                offeredSkill.skill.id;
            let matchId: number;
            let userStatus: 'SENDER' | 'RECEIVER';
            if (pendingMatchExistsBetween) {
              const matchIdWhereUserIsReceiver =
                matchWhereUserIsReceiverFromWantedSkill?.id ||
                matchWhereUserIsReceiverFromOfferedSkill?.id;
              const matchIdWhereUserIsSender =
                matchWhereUserIsSenderFromWantedSkill?.id ||
                matchWhereUserIsSenderFromOfferedSkill?.id;
              userStatus = matchIdWhereUserIsReceiver ? 'RECEIVER' : 'SENDER';
              matchId = (matchIdWhereUserIsReceiver ||
                matchIdWhereUserIsSender)!;
            }

            results.push({
              ...(pendingMatchExistsBetween && {
                pendingMatch: { id: matchId!, userStatus: userStatus! },
              }),
              otherUser: {
                id: user.id,
                name: this.stringsService.generateFullName(
                  user.firstName,
                  user.lastName,
                ),
                avatarUrl: user.avatarUrl,
              },
              offeredSkill: {
                id: offeredSkill.skill.id,
                name: offeredSkill.skill.name,
                categoryId: offeredSkill.skill.categoryId,
              },
              wantedSkill: {
                id: wantedSkill.skill.id,
                name: wantedSkill.skill.name,
                categoryId: wantedSkill.skill.categoryId,
              },
            });
          }
        }),
      ),
    );
    return results;
  }

  async getMatch(
    userId: number,
    { offeredSkillId, otherUserId, wantedSkillId }: GetSkillMatchQueryDto,
  ) {
    const _user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { skillsOffered: true, skillsWanted: true },
    });
    if (!_user)
      throw new NotFoundException(`User with id '${userId}' does not exist.`);

    const userSkillsSelect = {
      skill: {
        select: {
          ...miniSkillSelect,
          receiverSkillMatches: {
            where: {
              receiverId: userId,
              status: { in: ['PENDING', 'CONFIRMED'] as MatchStatus[] },
            },
            select: { senderSkillId: true, id: true, status: true },
          },
          senderSkillMatches: {
            where: {
              senderId: userId,
              status: { in: ['PENDING', 'CONFIRMED'] as MatchStatus[] },
            },
            select: { receiverSkillId: true, id: true, status: true },
          },
        },
      },
    };
    const otherUser = await this.prisma.user.findUnique({
      where: {
        id: otherUserId,
        AND: [{ id: { not: userId } }],
        skillsOffered: { some: { skillId: wantedSkillId } },
        skillsWanted: { some: { skillId: offeredSkillId } },
      },
      select: {
        ...miniUserSelect,
        skillsOffered: {
          where: { canMatch: true, skillId: wantedSkillId },
          select: userSkillsSelect,
        },
        skillsWanted: {
          where: { canMatch: true, skillId: offeredSkillId },
          select: userSkillsSelect,
        },
      },
    });

    const offeredSkill = otherUser?.skillsWanted[0];
    const wantedSkill = otherUser?.skillsOffered[0];

    const matchWhereUserIsReceiverFromWantedSkill =
      offeredSkill?.skill.receiverSkillMatches.find(
        (m) => m.senderSkillId == wantedSkill?.skill.id,
      );
    const matchWhereUserIsReceiverFromOfferedSkill =
      wantedSkill?.skill.receiverSkillMatches.find(
        (m) => m.senderSkillId == offeredSkill?.skill.id,
      );
    const matchWhereUserIsSenderFromWantedSkill =
      offeredSkill?.skill.senderSkillMatches.find(
        (m) => m.receiverSkillId == wantedSkill?.skill.id,
      );
    const matchWhereUserIsSenderFromOfferedSkill =
      wantedSkill?.skill.senderSkillMatches.find(
        (m) => m.receiverSkillId == offeredSkill?.skill.id,
      );

    const matchIsConfirmed =
      matchWhereUserIsReceiverFromWantedSkill?.status === 'CONFIRMED' ||
      matchWhereUserIsReceiverFromOfferedSkill?.status === 'CONFIRMED' ||
      matchWhereUserIsSenderFromWantedSkill?.status === 'CONFIRMED' ||
      matchWhereUserIsSenderFromOfferedSkill?.status === 'CONFIRMED';

    if (!otherUser || !offeredSkill || !wantedSkill || matchIsConfirmed)
      throw new NotFoundException('Match not found');

    const pendingMatchExistsBetween =
      matchWhereUserIsReceiverFromWantedSkill?.senderSkillId ===
        wantedSkill.skill.id ||
      matchWhereUserIsSenderFromWantedSkill?.receiverSkillId ===
        wantedSkill.skill.id ||
      matchWhereUserIsReceiverFromOfferedSkill?.senderSkillId ===
        offeredSkill.skill.id ||
      matchWhereUserIsSenderFromOfferedSkill?.receiverSkillId ===
        offeredSkill.skill.id;
    let matchId: number;
    let userStatus: 'SENDER' | 'RECEIVER';
    if (pendingMatchExistsBetween) {
      const matchIdWhereUserIsReceiver =
        matchWhereUserIsReceiverFromWantedSkill?.id ||
        matchWhereUserIsReceiverFromOfferedSkill?.id;
      const matchIdWhereUserIsSender =
        matchWhereUserIsSenderFromWantedSkill?.id ||
        matchWhereUserIsSenderFromOfferedSkill?.id;
      userStatus = matchIdWhereUserIsReceiver ? 'RECEIVER' : 'SENDER';
      matchId = (matchIdWhereUserIsReceiver || matchIdWhereUserIsSender)!;
    }

    const match: IMatch = {
      ...(pendingMatchExistsBetween && {
        pendingMatch: { id: matchId!, userStatus: userStatus! },
      }),
      otherUser: {
        id: otherUser.id,
        name: this.stringsService.generateFullName(
          otherUser.firstName,
          otherUser.lastName,
        ),
        avatarUrl: otherUser.avatarUrl,
      },
      offeredSkill: {
        id: offeredSkill.skill.id,
        name: offeredSkill.skill.name,
        category: offeredSkill.skill.category,
      },
      wantedSkill: {
        id: wantedSkill.skill.id,
        name: wantedSkill.skill.name,
        category: wantedSkill.skill.category,
      },
    };

    return match;
  }

  async getMyMatchRequests(userId: number) {
    const requestsSkillMatches = (
      await this.prisma.skillMatch.findMany({
        where: { receiverId: userId, status: 'PENDING' },
        select: {
          id: true,
          receiverSkill: { select: miniSkillSelect },
          sender: {
            select: miniUserSelect,
          },
          senderSkill: { select: miniSkillSelect },
          createdAt: true,
        },
      })
    ).map((m) => ({
      ...m,
      matchId: m.id,
      id: undefined,
      userSkill: m.receiverSkill,
      receiverSkill: undefined,
    }));
    return requestsSkillMatches;
  }

  async sendMatchRequest(
    userId: number,
    { skillId, receiverId, receiverSkillId }: AddSkillMatchDto,
  ) {
    const isUserReceiver = userId == receiverId;
    if (isUserReceiver)
      throw new BadRequestException('You cannnot be the receiver.');
    await this.dbUtils.validateRecordExists<User>('user', receiverId, {
      returnRecord: true,
    });

    const skillWanted = await this.prisma.skill.findFirst({
      where: { id: receiverSkillId },
      include: {
        _count: {
          select: {
            usersWanted: { where: { canMatch: true, userId } },
            usersOffered: { where: { canMatch: true, userId: receiverId } },
          },
        },
      },
    });
    if (!skillWanted)
      throw new NotFoundException('Skill wanted does not exist.');
    if (!skillWanted._count.usersWanted)
      throw new NotFoundException(
        'Skill wanted is not among your available wanted skills.',
      );
    if (!skillWanted._count.usersOffered)
      throw new NotFoundException(
        "Skill wanted is not among receiver's available offered skills.",
      );

    const skillOffered = await this.prisma.skill.findFirst({
      where: { id: skillId },
      include: {
        _count: {
          select: {
            usersOffered: { where: { userId, canMatch: true } },
            usersWanted: { where: { userId: receiverId, canMatch: true } },
          },
        },
      },
    });
    if (!skillOffered)
      throw new NotFoundException('Skill offered does not exist.');
    if (!skillOffered._count.usersOffered)
      throw new NotFoundException(
        'Skill offered is not among your available offered skills.',
      );
    if (!skillOffered._count.usersWanted)
      throw new NotFoundException(
        "Skill offered is not among receiver's available wanted skills.",
      );

    const existingSkillMatch = await this.prisma.skillMatch.findFirst({
      where: {
        OR: [
          {
            senderId: userId,
            receiverId,
            senderSkillId: skillId,
            receiverSkillId,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
          {
            senderId: receiverId,
            receiverId: userId,
            senderSkillId: receiverSkillId,
            receiverSkillId: skillId,
            status: { in: ['PENDING', 'CONFIRMED'] },
          },
        ],
      },
    });
    if (existingSkillMatch)
      throw new ConflictException(
        'There is an uncompleted skill match existing with same details between you and the receiver.',
      );

    const match = await this.prisma.skillMatch.create({
      data: {
        senderId: userId,
        receiverId: receiverId,
        senderSkillId: skillId,
        receiverSkillId: receiverSkillId,
      },
    });
    return { matchId: match.id };
  }

  async cancelMatchRequest(userId: number, matchId: number) {
    const match = await this.prisma.skillMatch.findUnique({
      where: { id: matchId, status: 'PENDING' },
    });
    if (!match)
      throw new NotFoundException(
        `Pending SkillMatch with id '${matchId}' does not exist.`,
      );

    const isUserSender = userId == match.senderId;
    if (!isUserSender)
      throw new BadRequestException('You are not the sender of this request.');

    await this.prisma.skillMatch.update({
      where: { id: matchId },
      data: { status: 'CANCELED', respondedAt: new Date() },
    });

    return { success: true };
  }

  async acceptMatchRequest(userId: number, matchId: number) {
    const match = await this.prisma.skillMatch.findUnique({
      where: { id: matchId, status: 'PENDING' },
    });
    if (!match)
      throw new NotFoundException(
        `Pending SkillMatch with id '${matchId}' does not exist.`,
      );

    const isUserReceiver = userId == match.receiverId;
    if (!isUserReceiver)
      throw new BadRequestException(
        'You are not the receiver of this request.',
      );

    await this.prisma.skillMatch.update({
      where: { id: matchId },
      data: {
        status: 'CONFIRMED',
        respondedAt: new Date(),
        exchangeRoom: { create: {} },
      },
    });

    return { success: true };
  }

  async declineMatchRequest(userId: number, matchId: number) {
    const match = await this.prisma.skillMatch.findUnique({
      where: { id: matchId, status: 'PENDING' },
    });
    if (!match)
      throw new NotFoundException(
        `Pending SkillMatch with id '${matchId}' does not exist.`,
      );

    const isUserReceiver = userId == match.receiverId;
    if (!isUserReceiver)
      throw new BadRequestException(
        'You are not the receiver of this request.',
      );

    await this.prisma.skillMatch.update({
      where: { id: matchId },
      data: { status: 'DECLINED', respondedAt: new Date() },
    });

    return { success: true };
  }

  async getMyOngoingMatches(userId: number) {
    const matches = (
      await this.prisma.skillMatch.findMany({
        where: {
          OR: [
            { receiverId: userId, status: 'CONFIRMED' },
            { senderId: userId, status: 'CONFIRMED' },
          ],
        },
        select: {
          id: true,
          receiver: {
            select: miniUserSelect,
          },
          receiverSkill: { select: miniSkillSelect },
          sender: {
            select: miniUserSelect,
          },
          senderSkill: { select: miniSkillSelect },
          exchangeRoom: { select: { id: true } },
          createdAt: true,
        },
      })
    ).map((m) => ({
      ...m,
      ...(m.receiver.id == userId
        ? {
            userSkill: m.receiverSkill,
            otherUser: {
              id: m.sender.id,
              name: this.stringsService.generateFullName(
                m.sender.firstName,
                m.sender.lastName,
              ),
              avatarUrl: m.sender.avatarUrl,
            },
            otherUserSkill: m.senderSkill,
          }
        : {
            userSkill: m.senderSkill,
            otherUser: {
              id: m.receiver.id,
              name: this.stringsService.generateFullName(
                m.receiver.firstName,
                m.receiver.lastName,
              ),
              avatarUrl: m.receiver.avatarUrl,
            },
            otherUserSkill: m.receiverSkill,
          }),
      exchangeRoomId: m.exchangeRoom!.id,
      exchangeRoom: undefined,
      sender: undefined,
      receiver: undefined,
      senderSkill: undefined,
      receiverSkill: undefined,
    }));

    return matches;
  }
}
