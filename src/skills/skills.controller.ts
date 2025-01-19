import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { RequestWithAuthPayload } from 'src/auth/interfaces/request-with-auth-payload.interface';
import { AddCategoryDto } from './dtos/add-category.dto';
import { AddSkillMatchDto } from './dtos/add-skill-match.dto';
import { AddSkillDto } from './dtos/add-skill.dto';
import { GetSkillMatchQueryDto } from './dtos/get-skill-match-query.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { UpdateSkillDto } from './dtos/update-skill.dto';
import { SkillsService } from './skills.service';

@Controller('skills')
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Get()
  getSkills() {
    return this.skillsService.getSkillsByCategories();
  }

  @Post()
  @UseGuards(AuthGuard, AdminGuard)
  addSkill(@Body() addSkillDto: AddSkillDto) {
    return this.skillsService.addSkill(addSkillDto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, AdminGuard)
  updateSkill(@Body() updateSkillDto: UpdateSkillDto, @Param('id') id: number) {
    return this.skillsService.updateSkill(id, updateSkillDto);
  }

  @Post('categories')
  @UseGuards(AuthGuard, AdminGuard)
  addCategory(@Body() addCategoryDto: AddCategoryDto) {
    return this.skillsService.addCategory(addCategoryDto);
  }

  @Patch('categories/:id')
  @UseGuards(AuthGuard, AdminGuard)
  updateCategory(
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Param('id') id: number,
  ) {
    return this.skillsService.updateCategory(id, updateCategoryDto);
  }

  @Get('matches')
  getUserMatches(@Request() req: RequestWithAuthPayload) {
    return this.skillsService.getUserMatches(req.auth!.sub);
  }

  @Get('match')
  getMatch(
    @Request() req: RequestWithAuthPayload,
    @Query() params: GetSkillMatchQueryDto,
  ) {
    return this.skillsService.getMatch(req.auth!.sub, params);
  }

  @Get('my-match-requests')
  getMyMatchRequests(@Request() req: RequestWithAuthPayload) {
    return this.skillsService.getMyMatchRequests(req.auth!.sub);
  }

  @Post('match-requests')
  sendMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Body() addSkillMatchDto: AddSkillMatchDto,
  ) {
    return this.skillsService.sendMatchRequest(req.auth!.sub, addSkillMatchDto);
  }

  @Post('cancel-match-request/:matchId')
  cancelMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Param('matchId') matchId: number,
  ) {
    return this.skillsService.cancelMatchRequest(req.auth!.sub, matchId);
  }

  @Post('accept-match-request/:matchId')
  acceptMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Param('matchId') matchId: number,
  ) {
    return this.skillsService.acceptMatchRequest(req.auth!.sub, matchId);
  }

  @Post('decline-match-request/:matchId')
  declineMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Param('matchId') matchId: number,
  ) {
    return this.skillsService.declineMatchRequest(req.auth!.sub, matchId);
  }

  @Get('my-ongoing-matches')
  getMyOngoingMatches(@Request() req: RequestWithAuthPayload) {
    return this.skillsService.getMyOngoingMatches(req.auth!.sub);
  }

  @Post('create-stream-to-start/:roomId')
  createStreamToStart(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
  ) {
    return this.skillsService.createStreamToStart(req.auth!.sub, roomId);
  }

  @Get('get-stream-to-join/:roomId')
  getStreamToJoin(
    @Request() req: RequestWithAuthPayload,
    @Param('roomId') roomId: number,
  ) {
    return this.skillsService.getStreamToJoin(req.auth!.sub, roomId);
  }
}
