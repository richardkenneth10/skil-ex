import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { RequestWithAuthPayload } from 'src/auth/interfaces/request-with-auth-payload.interface';
import { ChatsService } from './chats.service';
import { AddExchangeRoomMessageDto } from './dtos/add-exchange-room-message.dto';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto';

@Controller('chats')
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @Get('exchange-room-messages/:roomId')
  getExchangeRoomMessages(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
    @Query() query: GetMessagesQueryDto,
  ) {
    return this.chatsService.getExchangeRoomMessages(
      req.auth!.sub,
      roomId,
      query,
    );
  }

  @Post('exchange-room-messages/:roomId')
  addExchangeRoomMessage(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
    @Body() addExchangeRoomMessageDto: AddExchangeRoomMessageDto,
  ) {
    return this.chatsService.addExchangeRoomMessage(
      req.auth!.sub,
      roomId,
      addExchangeRoomMessageDto,
    );
  }
}
