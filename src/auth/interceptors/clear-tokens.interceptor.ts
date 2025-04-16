import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuthService } from '../auth.service';

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
        // const { accessName, refreshName, options } = authCookieConstants;
        // response.clearCookie(accessName, options);
        // response.clearCookie(refreshName, options);

        return { success: true };
      }),
    );
  }
}
