import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddExchangeRoomResourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  content: string;
}
