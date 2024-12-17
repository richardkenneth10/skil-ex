import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/db/prisma.service';
import { AtLeastOneField, Model } from './interfaces/db.interface';
import { isEqual } from 'lodash';

@Injectable()
export class DbService {
  constructor(private prisma: PrismaService) {}

  validateChangeExists<K>(record: K, updateData: Partial<K>) {
    let changeExists = false;
    for (const [key, val] of Object.entries(updateData) as [
      keyof typeof updateData,
      any,
    ][]) {
      const initialValue = Array.isArray(record[key])
        ? record[key].sort()
        : record[key];
      const updateValue = Array.isArray(val) ? val.sort() : val;

      if (!isEqual(updateValue, initialValue)) {
        changeExists = true;
        break;
      }
    }
    if (!changeExists)
      throw new BadRequestException('There are no changes to be made.');
  }

  validateRecordExists<M>(model: Model, id: number): Promise<void>;
  validateRecordExists<M>(
    model: Model,
    id: number,
    options: { returnRecord: true },
  ): Promise<NonNullable<M>>;

  async validateRecordExists<M>(
    model: Model,
    id: number,
    options?: { returnRecord: true },
  ) {
    if (options?.returnRecord) {
      const existingRecord = (await this.prisma[model as 'user'].findUnique({
        where: { id },
      })) as M;
      if (!existingRecord)
        throw new NotFoundException(
          `${model.capitalizeFirst()} with id '${id}' does not exist.`,
        );
      return existingRecord;
    } else {
      const recordExists = await this.prisma[model as 'user'].count({
        where: { id },
      });
      if (!recordExists)
        throw new NotFoundException(
          `${model.capitalizeFirst()} with id '${id}' does not exist.`,
        );
    }
  }

  async validateNoRecordWithValuesExists<M>(
    model: Model,
    data: AtLeastOneField<M>,
    options?: { idToExclude: number },
  ) {
    const recordWithValuesExists = await this.prisma[model as 'user'].count({
      where: {
        ...data,
        ...(options?.idToExclude && { id: { not: options.idToExclude } }),
      },
    });
    const dataEntries = Object.entries(data);

    if (recordWithValuesExists)
      throw new ConflictException(
        `${model.capitalizeFirst()} with ${dataEntries.reduce(
          (acc, cur, idx, arr) => {
            if (idx != 0)
              if (idx == arr.length - 1) acc += ' and ';
              else acc += ', ';
            acc += `${cur[0]} '${cur[1]}'`;
            return acc;
          },
          '',
        )} exists.`,
      );
  }
}
