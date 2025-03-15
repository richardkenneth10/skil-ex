import { forwardRef, Module } from '@nestjs/common';
import { PrismaModule } from 'src/db/prisma.module';
import { GatewaysModule } from 'src/gateways/gateways.module';
import { UsersModule } from 'src/users/users.module';
import { StreamsController } from './streams.controller';
import { StreamsService } from './streams.service';

@Module({
  imports: [PrismaModule, UsersModule, forwardRef(() => GatewaysModule)],
  providers: [StreamsService],
  controllers: [StreamsController],
  exports: [StreamsService],
})
export class StreamsModule {}
