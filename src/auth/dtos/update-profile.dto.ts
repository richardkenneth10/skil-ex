import { Transform } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  bio?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value == 'string' ? JSON.parse(value) : value,
  )
  @IsArray()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  skillIdsOffered?: number[];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value == 'string' ? JSON.parse(value) : value,
  )
  @IsArray()
  @ArrayUnique()
  @IsNumber({}, { each: true })
  skillIdsWanted?: number[];

  // @Exclude()
  // @IsAtLeastOneFieldPresent()
  // _atLeastOneField!: boolean; // Dummy property used for validation
}
