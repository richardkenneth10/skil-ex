import { Role } from '@prisma/client';

export interface IAuthPayload {
  sub: number;
  role: Role;
}

export interface IAuthFullPayload extends IAuthPayload {
  iat: number;
  exp: number;
}
