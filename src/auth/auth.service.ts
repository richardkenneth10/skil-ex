import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { SignUpDto } from './dtos/sign-up.dto';
import { SignInDto } from './dtos/sign-in.dto';
import { UAParser } from 'ua-parser-js';
import { PrismaService } from 'src/db/prisma.service';
import { authCookieConstants } from './constants/auth-cookie-constants';
import { jwtConstants } from './constants/jwt-constants';
import { IAuthPayload } from './interfaces/auth-payload.interface';
import { Request, Response } from 'express';
import { hash, compare } from 'bcrypt';
import { User } from '@prisma/client';
import { DbService } from 'src/utils/db/db.service';
import { UpdateProfileDto } from './dtos/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private dbUtils: DbService,
  ) {}

  async signUp({ name, email, password }: SignUpDto): Promise<any> {
    await this.dbUtils.validateNoRecordWithValuesExists<User>('user', {
      email,
    });
    const saltOrRounds = 10;
    const hashedPassword = await hash(password, saltOrRounds);
    const user = await this.usersService.createUser({
      name,
      email,
      password: hashedPassword,
    });
    return user;
  }

  async signIn({ email, password }: SignInDto): Promise<any> {
    //explicitly select password when needed because a global middleware removes it if not explicitly selected
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { ...this.generateUserSelectExcludingPassword(), password: true },
    });
    if (!user) throw new UnauthorizedException();
    const passwordsMatch = await compare(password, user.password);
    if (!passwordsMatch) throw new UnauthorizedException();

    return user;
  }

  private generateUserSelectExcludingPassword() {
    const selectObj: Partial<Record<keyof User, boolean>> = {};
    const modelFields = Object.keys(this.prisma.user.fields) as (keyof User)[];
    modelFields.forEach((field) => {
      if (field !== 'password') {
        selectObj[field] = true;
      }
    });
    return selectObj;
  }

  async getProfile(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        ...this.generateUserSelectExcludingPassword(),
        skillsOffered: { select: { skill: true } },
        skillsWanted: { select: { skill: true } },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateProfile(userId: number, data: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { skillsOffered: true, skillsWanted: true },
    });
    if (!user)
      throw new NotFoundException(`User with id '${userId}' does not exist.`);

    this.dbUtils.validateChangeExists(
      {
        ...user,
        skillIdsOffered: user.skillsOffered.map(({ skillId }) => skillId),
        skillIdsWanted: user.skillsWanted.map(({ skillId }) => skillId),
      },
      data,
    );

    if (data.skillIdsOffered) {
      const allSkillsOfferedExist =
        (await this.prisma.skill.count({
          where: { id: { in: data.skillIdsOffered } },
        })) === data.skillIdsOffered.length;
      if (!allSkillsOfferedExist)
        throw new BadRequestException(
          "Not all IDs of 'skillIdsOffered' exists.",
        );
    }
    if (data.skillIdsWanted) {
      const allSkillsWantedExist =
        (await this.prisma.skill.count({
          where: { id: { in: data.skillIdsWanted } },
        })) === data.skillIdsWanted.length;
      if (!allSkillsWantedExist)
        throw new BadRequestException(
          "Not all IDs of 'skillIdsWanted' exists.",
        );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.skillIdsOffered && {
          skillsOffered: {
            deleteMany: {},
            create: data.skillIdsOffered.map((skillId) => ({ skillId })),
          },
        }),
        ...(data.skillIdsWanted && {
          skillsWanted: {
            deleteMany: {},
            create: data.skillIdsWanted.map((skillId) => ({ skillId })),
          },
        }),
      },
      select: {
        ...this.generateUserSelectExcludingPassword(),
        skillsOffered: { select: { skill: true } },
        skillsWanted: { select: { skill: true } },
      },
    });

    return updatedUser;
  }

  async generateTokens(
    jwtService: JwtService,
    prisma: PrismaService,
    request: Request,
    payload: IAuthPayload,
  ) {
    const accessToken = await jwtService.signAsync(payload, {
      expiresIn: jwtConstants.accessExpiresIn,
      secret: jwtConstants.accessSecret,
    });

    const refreshToken = await jwtService.signAsync(payload, {
      expiresIn: jwtConstants.refreshExpiresIn,
      secret: jwtConstants.refreshSecret,
    });

    const deviceInfo = this.getDeviceInfo(request.headers['user-agent']!);
    const ipAddress = this.getIpAddress(request);

    await prisma.token.upsert({
      where: { userId_deviceInfo: { userId: payload.sub, deviceInfo } },
      update: { token: refreshToken },
      create: {
        token: refreshToken,
        userId: payload.sub,
        ipAddress,
        deviceInfo,
        expiresAt: new Date(Date.now() + authCookieConstants.refreshMaxAge),
      },
    });

    return { accessToken, refreshToken };
  }

  setTokens(res: Response, accessToken: string, refreshToken: string): void {
    const { accessName, accessMaxAge, refreshName, refreshMaxAge } =
      authCookieConstants;

    res.cookie(accessName, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: accessMaxAge,
    });

    res.cookie(refreshName, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: refreshMaxAge,
    });
  }

  async validateRefreshToken(
    prisma: PrismaService,
    refreshToken: string,
    request: Request,
    userId: number,
  ): Promise<boolean> {
    const deviceInfo = this.getDeviceInfo(request.headers['user-agent']!);

    const userToken = await prisma.token.findUnique({
      where: { userId_deviceInfo: { userId, deviceInfo } },
    });

    if (!userToken || userToken.revoked || userToken.expiresAt <= new Date()) {
      return false;
    }

    return refreshToken === userToken.token;
  }

  getDeviceInfo(userAgent: string): string {
    const parser = new UAParser(userAgent);
    const result = parser.getResult();

    return `${result.browser.name} on ${result.os.name}`;
  }

  getIpAddress(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded
      ? (typeof forwarded === 'string'
          ? forwarded.split(',')
          : forwarded)[0].trim()
      : req.ip!;
  }

  async clearRefreshToken(userId: number, deviceInfo: string) {
    await this.prisma.token.deleteMany({
      where: { userId, deviceInfo },
    });
  }

  async clearAllRefreshTokens(userId: number) {
    await this.prisma.token.deleteMany({
      where: { userId },
    });
  }
}
