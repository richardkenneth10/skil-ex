import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/db/prisma.module';
import { RoomsModule } from 'src/rooms/rooms.module';
import { ChatsController } from './chats.controller';
import { ChatsService } from './chats.service';

@Module({
  imports: [PrismaModule, RoomsModule],
  providers: [ChatsService],
  controllers: [ChatsController],
  exports: [ChatsService],
})
export class ChatsModule {}
