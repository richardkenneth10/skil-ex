import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';
import { PaginationDto } from 'src/utils/validators/dtos/pagination.dto';

export class GetMessagesQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(({ value }) => (value == 'true' ? true : false))
  @IsBoolean()
  includeSkillMatch: boolean = false;
}
