import { FileValidator } from '@nestjs/common';
import * as FileTypeMime from 'file-type-mime';
import { ICustomFileTypeValidatorOptions } from './interfaces/custom-file-type-validator-options.interface';

export class CustomFileTypeValidator extends FileValidator {
  private _allowedMimeTypes: string[];

  constructor(
    protected readonly validationOptions: ICustomFileTypeValidatorOptions,
  ) {
    super(validationOptions);
    this._allowedMimeTypes = this.validationOptions.fileTypes;
  }

  async isValid(file: Express.Multer.File): Promise<boolean> {
    const res = FileTypeMime.parse(file.buffer);
    return !res ? false : this._allowedMimeTypes.includes(res.mime);
  }

  buildErrorMessage = (file: any): string =>
    `Upload not allowed. Upload only files of type: ${this._allowedMimeTypes.join(', ')}`;
}
