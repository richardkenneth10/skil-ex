import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddExchangeRoomMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  content: string;
}
