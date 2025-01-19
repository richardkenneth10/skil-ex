import { IsInt, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class AddExchangeRoomMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  content: string;
}

export class AddExchangeRoomMessageExtendedDto extends AddExchangeRoomMessageDto {
  @IsInt()
  roomId: number;
}
