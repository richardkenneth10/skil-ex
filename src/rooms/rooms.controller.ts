import { Controller, Param, Post, Request } from '@nestjs/common';
import { RequestWithAuthPayload } from 'src/auth/interfaces/request-with-auth-payload.interface';
import { RoomsService } from './rooms.service';

@Controller('rooms')
export class RoomsController {
  constructor(private roomsService: RoomsService) {}

  @Post(':roomId/go-live')
  addExchangeRoomMessage(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
  ) {
    return this.roomsService.goLive(req.auth!.sub, roomId);
  }

  @Post(':roomId/join-live')
  getStreamToJoin(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
  ) {
    return this.roomsService.joinLive(req.auth!.sub, roomId);
  }
}
