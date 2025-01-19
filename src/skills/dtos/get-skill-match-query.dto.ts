import { Transform } from 'class-transformer';
import { IsInt } from 'class-validator';

export class GetSkillMatchQueryDto {
  @Transform(({ value }) => parseInt(value))
  @IsInt()
  offeredSkillId: number;

  @Transform(({ value }) => parseInt(value))
  @IsInt()
  otherUserId: number;

  @Transform(({ value }) => parseInt(value))
  @IsInt()
  wantedSkillId: number;
}
