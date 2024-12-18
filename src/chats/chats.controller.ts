import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
} from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { RequestWithAuthPayload } from 'src/auth/interfaces/request-with-auth-payload.interface';
import { ChatsService } from './chats.service';
import { PaginationDataDto } from 'src/utils/validators/dtos/pagination-data.dto';
import { AddExchangeRoomMessageDto } from './dtos/add-exchange-room-message.dto';

@Controller('chats')
export class ChatsController {
  constructor(private chatsService: ChatsService) {}

  @Get('exchange-room-messages/:skillMatchId')
  getExchangeRoomMessages(
    @Request() req: RequestWithAuthPayload,
    @Param('skillMatchId') skillMatchId: number,
    @Query() query: PaginationDataDto,
  ) {
    return this.chatsService.getExchangeRoomMessages(
      req.auth!.sub,
      skillMatchId,
      query,
    );
  }

  @Post('exchange-room-messages/:skillMatchId')
  addExchangeRoomMessage(
    @Request() req: RequestWithAuthPayload,
    @Param('skillMatchId') skillMatchId: number,
    @Body() addExchangeRoomMessageDto: AddExchangeRoomMessageDto,
  ) {
    return this.chatsService.addExchangeRoomMessage(
      req.auth!.sub,
      skillMatchId,
      addExchangeRoomMessageDto,
    );
  }
}
