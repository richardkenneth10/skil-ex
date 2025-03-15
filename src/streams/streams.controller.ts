import { Controller, Get, Param, Request } from '@nestjs/common';
import { RequestWithAuthPayload } from 'src/auth/interfaces/request-with-auth-payload.interface';
import { StreamsService } from './streams.service';

@Controller('streams')
export class StreamsController {
  constructor(private streamsService: StreamsService) {}

  @Get(':channelId/live-info')
  getLiveInfo(
    @Request() req: RequestWithAuthPayload,
    @Param('channelId') channelId: string,
  ) {
    return this.streamsService.getLiveInfo(req.auth!.sub, channelId);
  }
}
