import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { ChatsModule } from 'src/chats/chats.module';
import { RoomsModule } from 'src/rooms/rooms.module';
import { ChatGateway } from './chat/chat.gateway';
import { WebRTCGateway } from './web-rtc/web-rtc.gateway';

@Module({
  imports: [AuthModule, ChatsModule, RoomsModule],
  providers: [ChatGateway, WebRTCGateway],
  exports: [ChatGateway],
})
export class GatewaysModule {}
