import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SKIP_AUTH_KEY } from '../decorators/skip-auth.decorator';
import { AuthService } from '../auth.service';
import { Socket } from 'socket.io';

@Injectable()
export class WSAuthGuard implements CanActivate {
  constructor(
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

    const socket = context.switchToWs().getClient<Socket>();
    await this.authService.authenticateWebSocketClient(socket);
    return true;
  }
}
