import { PrismaClient } from '@prisma/client';

type PrismaClientKey = keyof PrismaClient;
type KeyNotStartingWith$<T> = T extends string
  ? T extends `$${string}`
    ? never
    : T
  : never;
export type Model = KeyNotStartingWith$<PrismaClientKey>;
export type OnlyOneField<T> = {
  [K in keyof T]: Pick<T, K> & Partial<Record<Exclude<keyof T, K>, never>>;
}[keyof T];
export type AtLeastOneField<T> = {
  [K in keyof T]: Pick<T, K> & Partial<T>;
}[keyof T];
