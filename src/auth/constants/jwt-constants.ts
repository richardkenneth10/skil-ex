export const jwtConstants = {
  secret: process.env.JWT_SECRET,
  accessExpiresIn: '30m',
  refreshExpiresIn: '7d',
};
