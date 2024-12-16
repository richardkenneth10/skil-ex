import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { authCookieConstants } from '../constants/auth-cookie-constants';
import { AuthService } from '../auth.service';

const uap = require('ua-parser-js');

@Injectable()
export class ClearTokensInterceptor implements NestInterceptor {
  constructor(private authService: AuthService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async (user: User) => {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        const deviceInfo = this.authService.getDeviceInfo(
          request.headers['user-agent']!,
        );
        await this.authService.clearRefreshToken(user.id, deviceInfo);
        const { accessName, refreshName } = authCookieConstants;
        response.clearCookie(accessName);
        response.clearCookie(refreshName);

        return { success: true };
      }),
    );
  }
}
