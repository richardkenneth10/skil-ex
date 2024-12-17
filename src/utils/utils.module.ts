import { Global, Module } from '@nestjs/common';
import { DbService } from './db/db.service';
import { PrismaModule } from 'src/db/prisma.module';
import { StringsService } from './strings/strings.service';
import { ValidatorsService } from './validators/validators.service';
import { ObjectsService } from './objects/objects.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [DbService, StringsService, ValidatorsService, ObjectsService],
  exports: [DbService],
})
export class UtilsModule {}
