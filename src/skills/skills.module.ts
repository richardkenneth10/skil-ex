import { Module } from '@nestjs/common';
import { SkillsService } from './skills.service';
import { SkillsController } from './skills.controller';
import { PrismaModule } from 'src/db/prisma.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [PrismaModule],
  providers: [SkillsService],
  controllers: [SkillsController],
})
export class SkillsModule {}
