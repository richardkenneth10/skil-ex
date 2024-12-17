import { IsInt } from 'class-validator';

export class AddSkillMatchDto {
  @IsInt()
  skillId: number;

  @IsInt()
  receiverId: number;

  @IsInt()
  receiverSkillId: number;
}
