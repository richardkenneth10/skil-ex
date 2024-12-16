import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { SkipAuth } from 'src/auth/decorators/skip-auth.decorator';
import { SignUpDto } from 'src/auth/dtos/sign-up.dto';
import { TokensInterceptor } from 'src/auth/interceptors/tokens.interceptor';
import { AddSkillDto } from './dtos/add-skill.dto';
import { SkillsService } from './skills.service';
import { AuthGuard } from 'src/auth/guards/auth.guard';
import { AdminGuard } from 'src/auth/guards/admin.guard';
import { AddCategoryDto } from './dtos/add-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { IDParamDto } from './dtos/id.dto';
import { UpdateSkillDto } from './dtos/update-skill.dto';

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
}
