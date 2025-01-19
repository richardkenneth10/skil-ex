import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from 'src/db/prisma.service';
import { AuthService } from '../auth.service';
import { IAuthPayload } from '../interfaces/auth-payload.interface';

@Injectable()
export class TokensInterceptor implements NestInterceptor {
  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(async (user: User) => {
        const request = context.switchToHttp().getRequest<Request>();
        const response = context.switchToHttp().getResponse<Response>();

        const payload: IAuthPayload = { sub: user.id, role: user.role };

        const { accessToken, refreshToken } =
          await this.authService.generateTokens(
            this.jwtService,
            this.prisma,
            request,
            payload,
          );
        this.authService.setTokens(response, accessToken, refreshToken);

        return user;
      }),
    );
  }
}
