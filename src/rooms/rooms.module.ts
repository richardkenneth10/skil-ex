import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/db/prisma.module';
import { GatewaysModule } from 'src/gateways/gateways.module';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  imports: [PrismaModule, GatewaysModule],
  providers: [RoomsService],
  controllers: [RoomsController],
  exports: [RoomsService],
})
export class RoomsModule {}
