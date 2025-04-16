import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth.service';
import { jwtConstants } from '../constants/jwt-constants';
import { SKIP_AUTH_KEY } from '../decorators/skip-auth.decorator';
import { IAuthFullPayload } from '../interfaces/auth-payload.interface';
import { RequestWithAuthPayload } from '../interfaces/request-with-auth-payload.interface';

@Injectable()
export class AuthGuard2 implements CanActivate {
  constructor(
    private jwtService: JwtService,
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
    const { accessToken, refreshToken } = request.cookies;
    // console.log(request.cookies);

    if (!accessToken) {
      if (!refreshToken) throw new UnauthorizedException();
      else await this.authService.refreshAccessToken(refreshToken, request);
    } else {
      try {
        const payload = await this.jwtService.verifyAsync<IAuthFullPayload>(
          accessToken,
          {
            secret: jwtConstants.secret,
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
