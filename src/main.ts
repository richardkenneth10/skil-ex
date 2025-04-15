import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as fs from 'node:fs';
import { AppModule } from './app.module';
import './utils/strings/interfaces/strings.interface';

async function bootstrap() {
  const httpsOptions =
    process.env.NODE_ENV === 'local'
      ? {
          key: fs.readFileSync('./certificates/localhost-key.pem'),
          cert: fs.readFileSync('./certificates/localhost.pem'),
        }
      : undefined;
  const app = await NestFactory.create(AppModule, { httpsOptions });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  app.enableCors({
    origin: true,
    //  ['https://192.168.43.174:3001', 'https://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
