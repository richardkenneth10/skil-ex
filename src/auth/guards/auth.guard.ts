import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { jwtConstants } from '../constants/jwt-constants';
import { Response } from 'express';
import { Reflector } from '@nestjs/core';
import { SKIP_AUTH_KEY } from '../decorators/skip-auth.decorator';
import {
  IAuthFullPayload,
  IAuthPayload,
} from '../interfaces/auth-payload.interface';
import { RequestWithAuthPayload } from '../interfaces/request-with-auth-payload.interface';
import { PrismaService } from 'src/db/prisma.service';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private reflector: Reflector,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipAuth = this.reflector.getAllAndOverride<boolean>(SKIP_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skipAuth) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuthPayload>();
    const response = context.switchToHttp().getResponse<Response>();
    const { accessToken, refreshToken } = request.cookies;

    if (!accessToken) {
      if (!refreshToken) throw new UnauthorizedException();
      else
        await refreshAccessToken(
          this.authService,
          this.jwtService,
          this.prisma,
          refreshToken,
          request,
          response,
        );
    } else {
      try {
        const payload = await this.jwtService.verifyAsync<IAuthFullPayload>(
          accessToken,
          {
            secret: jwtConstants.accessSecret,
          },
        );
        request.auth = payload;
      } catch {
        throw new UnauthorizedException();
      }
    }
    return true;
  }
}

const refreshAccessToken = async (
  authService: AuthService,
  jwtService: JwtService,
  prisma: PrismaService,
  refreshToken: string,
  request: RequestWithAuthPayload,
  response: Response,
) => {
  try {
    const { sub, role } = await jwtService.verifyAsync<IAuthFullPayload>(
      refreshToken,
      {
        secret: jwtConstants.refreshSecret,
      },
    );
    const isValidRefreshToken = await authService.validateRefreshToken(
      prisma,
      refreshToken,
      request,
      sub,
    );
    if (!isValidRefreshToken) throw new UnauthorizedException();

    const payload: IAuthPayload = { sub, role };

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await authService.generateTokens(jwtService, prisma, request, payload);

    request.auth = await jwtService.verifyAsync<IAuthFullPayload>(
      newAccessToken,
      {
        secret: jwtConstants.accessSecret,
      },
    );
    authService.setTokens(response, newAccessToken, newRefreshToken);
  } catch (error) {
    throw new UnauthorizedException();
  }
};
