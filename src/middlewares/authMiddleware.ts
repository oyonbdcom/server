import httpStatus from 'http-status';
// src/middlewares/auth.ts
import { UserRole } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import config from '../config/config';
import { jwtTokenHelper } from '../helper/jwtHelper';
import prisma from '../prisma/client';
import ApiError from '../utils/apiError';

interface JwtPayload {
  userId: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: UserRole };
    }
  }
}

// auth.middleware.ts
export const protect = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'You are not authorized');
    }

    const token = authHeader.split(' ')[1];

    // 🔍 FIX: Wrap verification to catch "TokenExpiredError"
    let decoded;
    try {
      decoded = jwtTokenHelper.verifyToken(token, config.jwt.access_secret as string) as JwtPayload;
    } catch (err) {
      // If token is expired or invalid, send 401 to trigger frontend refresh
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Token expired or invalid');
    }

    if (!decoded.userId) {
      throw new ApiError(httpStatus.UNAUTHORIZED, 'Invalid token payload');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, deactivate: true },
    });

    if (!user || user.deactivate) {
      throw new ApiError(httpStatus.FORBIDDEN, 'User not found or disabled');
    }

    req.user = { id: user.id, role: user.role };
    next();
  } catch (error) {
    next(error); // Pass to global error handler
  }
};

// Role-based access
export const restrictTo =
  (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(httpStatus.UNAUTHORIZED, 'Not authorized'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(httpStatus.BAD_REQUEST, 'You do not have permission to perform this action'),
      );
    }

    next();
  };
