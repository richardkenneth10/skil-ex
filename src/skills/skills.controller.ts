import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { AddSkillDto } from './dtos/add-skill.dto';
import { SkillsService } from './skills.service';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AddCategoryDto } from './dtos/add-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { UpdateSkillDto } from './dtos/update-skill.dto';
import { RequestWithAuthPayload } from 'src/auth/interfaces/request-with-auth-payload.interface';
import { AddSkillMatchDto } from './dtos/add-skill-match.dto';

@Controller('skills')
export class SkillsController {
  constructor(private skillsService: SkillsService) {}

  @Get()
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
  getUserMatches(@Request() req: RequestWithAuthPayload) {
    return this.skillsService.getUserMatches(req.auth!.sub);
  }

  @Get('my-match-requests')
  @UseGuards(AuthGuard)
  getMyMatchRequests(@Request() req: RequestWithAuthPayload) {
    return this.skillsService.getMyMatchRequests(req.auth!.sub);
  }

  @Post('match-requests')
  @UseGuards(AuthGuard)
  sendMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Body() addSkillMatchDto: AddSkillMatchDto,
  ) {
    return this.skillsService.sendMatchRequest(req.auth!.sub, addSkillMatchDto);
  }

  @Post('cancel-match-request/:matchId')
  @UseGuards(AuthGuard)
  cancelMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Param('matchId') matchId: number,
  ) {
    return this.skillsService.cancelMatchRequest(req.auth!.sub, matchId);
  }

  @Post('accept-match-request/:matchId')
  @UseGuards(AuthGuard)
  acceptMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Param('matchId') matchId: number,
  ) {
    return this.skillsService.acceptMatchRequest(req.auth!.sub, matchId);
  }

  @Post('decline-match-request/:matchId')
  @UseGuards(AuthGuard)
  declineMatchRequest(
    @Request() req: RequestWithAuthPayload,
    @Param('matchId') matchId: number,
  ) {
    return this.skillsService.declineMatchRequest(req.auth!.sub, matchId);
  }

  @Get('my-ongoing-matches')
  @UseGuards(AuthGuard)
  getMyOngoingMatches(@Request() req: RequestWithAuthPayload) {
    return this.skillsService.getMyOngoingMatches(req.auth!.sub);
  }
}
