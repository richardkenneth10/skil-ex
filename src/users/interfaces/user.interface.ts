import { User as PrismaUser } from '@prisma/client';
export type UserWithoutPassword = Omit<PrismaUser, 'password'>;
