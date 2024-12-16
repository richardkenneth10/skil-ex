import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './db/prisma.module';
import { SkillsModule } from './skills/skills.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule
      .forRoot
      //   {
      //   envFilePath: ['.env.development.local', '.env.development'],
      // }
      (),
    JwtModule.register({}),
    PrismaModule,
    AuthModule,
    UsersModule,
    SkillsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
