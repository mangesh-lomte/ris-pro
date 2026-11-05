import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/db';
import { AppError } from '../utils/appError';
import { JwtPayload } from '../types/api.types';

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('Bearer token not provided');
    }

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    } catch {
      throw AppError.unauthorized('Invalid or expired authentication token', 'TOKEN_EXPIRED');
    }

    // Verify user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
      },
    });

    if (!user) {
      throw AppError.unauthorized('User associated with this token no longer exists', 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw AppError.forbidden('User account is deactivated. Contact Radiology Administrator.', 'ACCOUNT_DISABLED');
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
}
