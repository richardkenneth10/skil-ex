import {
  ConflictException,
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

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
  ) {}

  async signUp({ name, email, password }: SignUpDto): Promise<any> {
    const existingUser = await this.usersService.findOneByEmail(email);
    if (existingUser) {
      throw new ConflictException(`User with email ${email} exists.`);
    }
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
    const user = await this.usersService.findOneByEmail(email);
    if (!user) throw new UnauthorizedException();
    const passwordsMatch = await compare(password, user.password);
    if (!passwordsMatch) throw new UnauthorizedException();

    return user;
  }

  async getProfile(userId: number) {
    const user = await this.usersService.findOne(userId);
    if (!user) throw new NotFoundException();
    return user;
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
      secure: process.env.NODE_ENV === 'production', // Use HTTPS in production
      sameSite: 'strict', // Prevent CSRF
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
