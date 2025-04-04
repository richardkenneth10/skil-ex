import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as cookieParser from 'cookie-parser';
import * as fs from 'node:fs';
import { AppModule } from './app.module';
import './utils/strings/interfaces/strings.interface';

async function bootstrap() {
  const httpsOptions = {
    key: fs.readFileSync('./certificates/localhost-key.pem'),
    cert: fs.readFileSync('./certificates/localhost.pem'),
  };
  const app = await NestFactory.create(AppModule, { httpsOptions });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.use(cookieParser());
  app.enableCors({
    origin: ['https://192.168.43.174:3001', 'https://localhost:3001'],
    // methods: 'GET,HEAD,POST,PUT,DELETE,PATCH',
    credentials: true,
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
