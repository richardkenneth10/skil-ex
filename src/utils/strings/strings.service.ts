import { Injectable } from '@nestjs/common';

@Injectable()
export class StringsService {
  generateFullName = (firstName: string, lastName: string) =>
    `${firstName} ${lastName}`;
}
