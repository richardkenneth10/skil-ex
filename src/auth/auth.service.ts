import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { User } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { Request } from 'express';
import { existsSync } from 'fs';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import { Socket } from 'socket.io';
import { Handshake } from 'socket.io/dist/socket-types';
import { PrismaService } from 'src/db/prisma.service';
import { miniSkillSelect } from 'src/utils/db/constants/mini-skill-select.constant';
import { DbService } from 'src/utils/db/db.service';
import { UAParser } from 'ua-parser-js';
import { UsersService } from '../users/users.service';
import { authCookieConstants } from './constants/auth-cookie-constants';
import { jwtConstants } from './constants/jwt-constants';
import { SignInDto } from './dtos/sign-in.dto';
import { SignUpDto } from './dtos/sign-up.dto';
import { UpdateProfileDto } from './dtos/update-profile.dto';
import {
  IAuthFullPayload,
  IAuthPayload,
} from './interfaces/auth-payload.interface';
import { RequestWithAuthPayload } from './interfaces/request-with-auth-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private dbUtils: DbService,
    private jwtService: JwtService,
  ) {}

  async signUp({
    firstName,
    lastName,
    email,
    password,
  }: SignUpDto): Promise<any> {
    await this.dbUtils.validateNoRecordWithValuesExists<User>('user', {
      email,
    });
    const saltOrRounds = 10;
    const hashedPassword = await hash(password, saltOrRounds);
    const user = await this.usersService.createUser({
      firstName,
      lastName,
      email,
      password: hashedPassword,
    });
    return { ...user, password: undefined };
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

    return { ...user, password: undefined };
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
        skillsOffered: { select: { skill: { select: miniSkillSelect } } },
        skillsWanted: { select: { skill: { select: miniSkillSelect } } },
      },
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  async updateProfile(
    userId: number,
    data: UpdateProfileDto,
    avatar?: Express.Multer.File,
  ) {
    if (!avatar && Object.keys(data).length == 0)
      throw new BadRequestException('At least one field must be provided');

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { skillsOffered: true, skillsWanted: true },
    });
    if (!user)
      throw new NotFoundException(`User with id '${userId}' does not exist.`);

    if (!avatar)
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

    let avatarUrl: string | undefined = undefined;
    if (avatar) {
      const uniqueFileName = `avatar-${Date.now()}-${Math.round(
        Math.random() * 1e9,
      )}.${avatar.originalname.split('.').pop()}`;

      const uploadDir = join(process.cwd(), 'uploads', 'avatars');
      const filePath = join(uploadDir, uniqueFileName);

      const BASE_URL = process.env.BASE_URL;
      // Manually write the buffer to a file
      try {
        if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true }); // Create the directory if it doesn't exist
        await writeFile(filePath, avatar.buffer); // Write buffer to file
      } catch (error) {
        throw new BadRequestException('Failed to save file: ' + error.message);
      }

      // Save the file path to the user's profile in the database
      avatarUrl = `${BASE_URL}/uploads/avatars/${uniqueFileName}`;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.bio && { bio: data.bio }),
        ...(avatarUrl && { avatarUrl }),
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
    const access = await jwtService.signAsync(payload, {
      expiresIn: jwtConstants.accessExpiresIn,
      secret: jwtConstants.secret,
    });

    const refresh = await jwtService.signAsync(payload, {
      expiresIn: jwtConstants.refreshExpiresIn,
      secret: jwtConstants.secret,
    });

    const deviceInfo = this.getDeviceInfo(request.headers['user-agent']!);
    const ipAddress = this.getIpAddress(request);

    const expiresAt = new Date(Date.now() + authCookieConstants.refreshMaxAge);
    await prisma.token.upsert({
      where: { userId_deviceInfo: { userId: payload.sub, deviceInfo } },
      update: { token: refresh, expiresAt },
      create: {
        token: refresh,
        userId: payload.sub,
        ipAddress,
        deviceInfo,
        expiresAt,
      },
    });

    return { access, refresh };
  }

  // setTokens(res: Response, accessToken: string, refreshToken: string): void {
  //   const { accessName, accessMaxAge, refreshName, refreshMaxAge, options } =
  //     authCookieConstants;

  //   res.cookie(accessName, accessToken, { ...options, maxAge: accessMaxAge });

  //   res.cookie(refreshName, refreshToken, {
  //     ...options,
  //     maxAge: refreshMaxAge,
  //   });
  // }

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

  // refreshAccessToken = async (

  //   refreshToken: string,
  //   request: RequestWithAuthPayload,
  // ) => {
  //   try {
  //     const { sub, role } = await this.jwtService.verifyAsync<IAuthFullPayload>(
  //       refreshToken,
  //       {
  //         secret: jwtConstants.secret,
  //       },
  //     );
  //     const isValidRefreshToken = await this.validateRefreshToken(
  //       this.prisma,
  //       refreshToken,
  //       request,
  //       sub,
  //     );
  //     if (!isValidRefreshToken) throw new UnauthorizedException();

  //     const payload: IAuthPayload = { sub, role };

  //     const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
  //       await this.generateTokens(this.jwtService, this.prisma, request, payload);

  //     request.auth = payload;
  //     this.setTokens(response, newAccessToken, newRefreshToken);
  //   } catch (_) {
  //     throw new UnauthorizedException();
  //   }
  // };

  refreshAccessToken = async (
    refreshToken: string,
    request: RequestWithAuthPayload,
  ) => {
    try {
      const { sub, role } = await this.jwtService.verifyAsync<IAuthFullPayload>(
        refreshToken,
        {
          secret: jwtConstants.secret,
        },
      );
      const isValidRefreshToken = await this.validateRefreshToken(
        this.prisma,
        refreshToken,
        request,
        sub,
      );
      if (!isValidRefreshToken) throw new UnauthorizedException();

      const payload: IAuthPayload = { sub, role };

      const tokens = await this.generateTokens(
        this.jwtService,
        this.prisma,
        request,
        payload,
      );

      request.auth = payload;

      return tokens;
    } catch (_) {
      throw new UnauthorizedException();
    }
  };

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

  // async authenticateWebSocketClient2(socket: Socket) {
  //   const unauthorizedException = new WsException('Unauthorized');

  //   const cookies = socket.handshake.headers.authorization;
  //   // console.log(cookies);

  //   if (!cookies) throw unauthorizedException;
  //   const { accessToken } = this.parseCookies(cookies);

  //   try {
  //     const payload = await this.jwtService.verifyAsync<IAuthFullPayload>(
  //       accessToken,
  //       {
  //         secret: jwtConstants.secret,
  //       },
  //     );
  //     (socket.request as RequestWithAuthPayload).auth = payload;
  //   } catch (_) {
  //     throw unauthorizedException;
  //   }
  // }

  async authenticateWebSocketClient(socket: Socket) {
    const unauthorizedException = new WsException('Unauthorized');

    const accessToken = socket.handshake.auth.token;

    if (!accessToken) throw unauthorizedException;

    try {
      const payload = await this.jwtService.verifyAsync<IAuthFullPayload>(
        accessToken,
        {
          secret: jwtConstants.secret,
        },
      );
      (socket.request as RequestWithAuthPayload).auth = payload;
    } catch (_) {
      throw unauthorizedException;
    }
  }

  extractTokenFromHeader = (request: Request | Handshake) => {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  };

  private parseCookies = (cookies: string) => {
    return cookies
      .split(';')
      .map((cookie) => cookie.trim())
      .reduce(
        (acc, cookie) => {
          const [key, value] = cookie.split('=');
          acc[key] = value;
          return acc;
        },
        {} as Record<string, string>,
      );
  };
}
