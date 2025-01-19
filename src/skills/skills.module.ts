import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/db/prisma.module';
import { GatewaysModule } from 'src/gateways/gateways.module';
import { SkillsController } from './skills.controller';
import { SkillsService } from './skills.service';

@Module({
  imports: [PrismaModule, GatewaysModule],
  providers: [SkillsService],
  controllers: [SkillsController],
})
export class SkillsModule {}
