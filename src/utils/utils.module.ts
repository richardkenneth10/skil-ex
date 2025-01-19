import { Global, Module } from '@nestjs/common';
import { PrismaModule } from 'src/db/prisma.module';
import { DbService } from './db/db.service';
import { ObjectsService } from './objects/objects.service';
import { StringsService } from './strings/strings.service';
import { ValidatorsService } from './validators/validators.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [DbService, StringsService, ValidatorsService, ObjectsService],
  exports: [DbService, StringsService, ValidatorsService, ObjectsService],
})
export class UtilsModule {}
