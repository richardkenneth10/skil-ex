import { Exclude } from 'class-transformer';
import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';
import { IsAtLeastOneFieldPresent } from 'src/utils/validators/decorators/is-at-least-one-field-present.decorator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  skillIdsOffered?: number[];

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  skillIdsWanted?: number[];

  @Exclude()
  @IsAtLeastOneFieldPresent()
  _atLeastOneField!: boolean; // Dummy property used for validation
}
