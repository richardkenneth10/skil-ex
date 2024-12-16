import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RequestWithAuthPayload } from '../interfaces/request-with-auth-payload.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor() {}

  canActivate = (context: ExecutionContext) =>
    context.switchToHttp().getRequest<RequestWithAuthPayload>().auth?.role ===
    'ADMIN';
}
