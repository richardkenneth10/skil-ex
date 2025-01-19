import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { ChatsModule } from './chats/chats.module';
import { PrismaModule } from './db/prisma.module';
import { GatewaysModule } from './gateways/gateways.module';
import { ResourcesModule } from './resources/resources.module';
import { SkillsModule } from './skills/skills.module';
import { UsersModule } from './users/users.module';
import { UtilsModule } from './utils/utils.module';
import { RoomsModule } from './rooms/rooms.module';

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
    UtilsModule,
    ChatsModule,
    ResourcesModule,
    GatewaysModule,
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'), // Serve "uploads" directory
      serveRoot: '/uploads', // Route prefix for accessing files
    }),
    RoomsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
