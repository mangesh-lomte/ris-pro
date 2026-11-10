import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { AppError } from '../utils/appError';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication is required'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Role '${req.user.role}' is not authorized to access this clinical resource. Required: [${allowedRoles.join(', ')}]`,
          'FORBIDDEN_ROLE'
        )
      );
    }

    next();
  };
}

