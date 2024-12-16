import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { AddSkillDto } from './dtos/add-skill.dto';
import { AddCategoryDto } from './dtos/add-category.dto';
import { UpdateCategoryDto } from './dtos/update-category.dto';
import { UpdateSkillDto } from './dtos/update-skill.dto';

@Injectable()
export class SkillsService {
  constructor(private prisma: PrismaService) {}

  async getSkillsByCategories() {
    const skillsByCategories = await this.prisma.category.findMany({
      select: {
        id: true,
        name: true,
        skills: { select: { id: true, name: true } },
      },
    });
    return { categories: skillsByCategories };
  }

  async addSkill(data: AddSkillDto) {
    const categoryExists = await this.prisma.category.count({
      where: { id: data.categoryId },
    });
    if (!categoryExists)
      throw new NotFoundException(
        `Category with id: ${data.categoryId} does not exist.`,
      );
    const skillInCategoryExists = await this.prisma.skill.count({
      where: { name: data.name, categoryId: data.categoryId },
    });
    if (skillInCategoryExists)
      throw new ConflictException(
        `Skill with name '${data.name}' exists in category with id: ${data.categoryId}.`,
      );

    const skill = await this.prisma.skill.create({ data });
    return skill;
  }

  async updateSkill(id: number, data: UpdateSkillDto) {
    const existingSkill = await this.prisma.skill.findFirst({
      where: { id },
    });
    if (!existingSkill)
      throw new NotFoundException(`Skill with id: ${id} does not exist.`);

    let changeExists = false;
    for (const [key, val] of Object.entries(data) as [
      keyof typeof data,
      any,
    ][]) {
      if (val !== existingSkill[key]) {
        changeExists = true;
        break;
      }
    }
    if (!changeExists)
      throw new BadRequestException('There are no changes to be made.');

    const categoryExists = await this.prisma.category.count({
      where: { id: data.categoryId },
    });
    if (!categoryExists)
      throw new NotFoundException(
        `Category with id: ${data.categoryId} does not exist.`,
      );

    const skillInCategoryExists = await this.prisma.skill.count({
      where: { name: data.name, categoryId: data.categoryId, id: { not: id } },
    });
    if (skillInCategoryExists)
      throw new ConflictException(
        `Skill with name '${data.name}' exists in category with id: ${data.categoryId}.`,
      );

    const skill = await this.prisma.skill.update({
      where: { id },
      data,
    });
    return skill;
  }

  async addCategory(data: AddCategoryDto) {
    const categoryNameExists = await this.prisma.category.count({
      where: { name: data.name },
    });
    if (categoryNameExists)
      throw new ConflictException(`Category with name '${data.name}' exists.`);
    const category = await this.prisma.category.create({ data });
    return category;
  }

  async updateCategory(id: number, data: UpdateCategoryDto) {
    const existingCategory = await this.prisma.category.findFirst({
      where: { id },
    });
    if (!existingCategory)
      throw new NotFoundException(`Category with id: ${id} does not exist.`);

    let changeExists = false;
    for (const [key, val] of Object.entries(data) as [
      keyof typeof data,
      any,
    ][]) {
      if (val !== existingCategory[key]) {
        changeExists = true;
        break;
      }
    }
    if (!changeExists)
      throw new BadRequestException('There are no changes to be made.');

    const categoryNameExists = await this.prisma.category.count({
      where: { name: data.name, id: { not: id } },
    });
    if (categoryNameExists)
      throw new ConflictException(`Category with name '${data.name}' exists.`);

    const category = await this.prisma.category.update({
      where: { id },
      data,
    });
    return category;
  }
}
