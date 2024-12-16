import { IsNotEmpty, IsNumber } from 'class-validator';

export class UpdateSkillDto {
  @IsNotEmpty()
  name: string;

  @IsNumber()
  categoryId: number;
}
