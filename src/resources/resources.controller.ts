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
import { PaginationDto } from 'src/utils/validators/dtos/pagination.dto';
import { AddExchangeRoomResourceDto } from './dtos/add-exchange-room-resource.dto';
import { ResourcesService } from './resources.service';

@Controller('resources')
export class ResourcesController {
  constructor(private resourcesService: ResourcesService) {}

  @Get('exchange-room/:roomId')
  getExchangeRoomResources(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
    @Query() query: PaginationDto,
  ) {
    return this.resourcesService.getExchangeRoomResources(
      req.auth!.sub,
      roomId,
      query,
    );
  }

  @Post('exchange-room/:roomId')
  addExchangeRoomResource(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
    @Body() addExchangeRoomResourceDto: AddExchangeRoomResourceDto,
  ) {
    return this.resourcesService.addExchangeRoomResource(
      req.auth!.sub,
      roomId,
      addExchangeRoomResourceDto,
    );
  }
}
