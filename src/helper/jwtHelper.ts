import jwt, { JwtPayload, Secret } from 'jsonwebtoken';
import config from '../config/config';

const accessToken = (payload: object) => {
  return jwt.sign(payload, config.jwt.access_secret, {
    expiresIn: '5d',
  });
};
const refreshToken = (payload: object) => {
  return jwt.sign(payload, config.jwt.refresh_secret, {
    expiresIn: '365d',
  });
};
const verifyToken = (token: string, secret: Secret) => jwt.verify(token, secret) as JwtPayload;

export const jwtTokenHelper = {
  accessToken,
  refreshToken,
  verifyToken,
};
