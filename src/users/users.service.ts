import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, User } from '@prisma/client';
import { IMiniUser } from 'src/auth/interfaces/mini-user.interface';
import { PrismaService } from 'src/db/prisma.service';
import { miniUserSelect } from 'src/utils/db/constants/mini-user-select.constant';
import { StringsService } from 'src/utils/strings/strings.service';

// This should be a real class/interface representing a user entity

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private stringsService: StringsService,
  ) {}

  async findOne(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findOneByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async createUser(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({
      data,
    });
  }

  async getUserPublicData(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: miniUserSelect,
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  generateMiniUser({
    id,
    firstName,
    lastName,
    avatarUrl,
  }: Pick<User, keyof typeof miniUserSelect>): IMiniUser {
    return {
      id,
      name: this.stringsService.generateFullName(firstName, lastName),
      avatarUrl,
    };
  }
}
