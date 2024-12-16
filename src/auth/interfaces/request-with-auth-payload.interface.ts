import { Request } from 'express';
import { IAuthPayload } from './auth-payload.interface';

export interface RequestWithAuthPayload extends Request {
  auth?: IAuthPayload;
}
