import { CookieOptions } from 'express';

export const authCookieConstants = {
  accessName: 'accessToken',
  refreshName: 'refreshToken',
  accessMaxAge: 30 * 60 * 1000, //30 minutes
  refreshMaxAge: 7 * 24 * 60 * 60 * 1000, //7 days
  options: {
    // httpOnly: true,
    secure: true,
    sameSite:
      process.env.NODE_ENV === 'production'
        ? 'lax'
        : ('none' as boolean | 'lax' | 'strict' | 'none' | undefined),
  } as CookieOptions,
};
