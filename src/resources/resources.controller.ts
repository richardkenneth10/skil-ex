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
import { ResourcesService } from './resources.service';
import { PaginationDataDto } from 'src/utils/validators/dtos/pagination-data.dto';
import { AddExchangeRoomResourceDto } from './dtos/add-exchange-room-resource.dto';

@Controller('resources')
export class ResourcesController {
  constructor(private resourcesService: ResourcesService) {}

  @Get('exchange-room/:skillMatchId')
  getExchangeRoomResources(
    @Request() req: RequestWithAuthPayload,
    @Param('skillMatchId') skillMatchId: number,
    @Query() query: PaginationDataDto,
  ) {
    return this.resourcesService.getExchangeRoomResources(
      req.auth!.sub,
      skillMatchId,
      query,
    );
  }

  @Post('exchange-room/:skillMatchId')
  addExchangeRoomResource(
    @Request() req: RequestWithAuthPayload,
    @Param('skillMatchId') skillMatchId: number,
    @Body() addExchangeRoomResourceDto: AddExchangeRoomResourceDto,
  ) {
    return this.resourcesService.addExchangeRoomResource(
      req.auth!.sub,
      skillMatchId,
      addExchangeRoomResourceDto,
    );
  }
}
