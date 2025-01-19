import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export function IsAtLeastOneFieldPresent(
  validationOptions?: ValidationOptions,
) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isAtLeastOneFieldPresent',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          // Check if at least one field has a value
          const object = args.object as Record<string, any>;
          console.log(object);

          return Object.values(object).some(
            (v) => v !== undefined && v !== null,
          );
        },
        defaultMessage(): string {
          return 'At least one field must be provided';
        },
      },
    });
  };
}
