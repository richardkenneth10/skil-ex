import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { authCookieConstants } from '../constants/auth-cookie-constants';
import { AuthService } from '../auth.service';

const uap = require('ua-parser-js');

@Injectable()
export class ClearAllTokensInterceptor implements NestInterceptor {
  constructor(private authService: AuthService) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async (user: User) => {
        const response = context.switchToHttp().getResponse<Response>();

        await this.authService.clearAllRefreshTokens(user.id);
        const { accessName, refreshName } = authCookieConstants;
        response.clearCookie(accessName);
        response.clearCookie(refreshName);

        return { success: true };
      }),
    );
  }
}
