import { Injectable, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();

    const excludeUserPasswordMiddleware = async (
      params: Prisma.MiddlewareParams,
      next: (params: Prisma.MiddlewareParams) => Promise<any>,
    ) => {
      const result = await next(params);

      if (params.model === 'User' && params.args?.select?.password !== true)
        delete result?.password;

      return result;
    };
    this.$use(excludeUserPasswordMiddleware);
  }
}
