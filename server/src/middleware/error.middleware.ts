import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { AppError } from '../utils/appError';
import { sendError } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): Response {
  logger.error(`Error processing ${req.method} ${req.originalUrl}: ${err.message}`, {
    name: err.name,
    stack: env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // 1. AppError (operational / intentional clinical errors)
  if (err instanceof AppError) {
    return sendError(res, err.message, err.statusCode, err.details, err.code);
  }

  // 2. Prisma Database Errors
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002': {
        const target = (err.meta?.target as string[])?.join(', ') || 'field';
        return sendError(
          res,
          `A record with this ${target} already exists. Unique constraint violation.`,
          409,
          { target: err.meta?.target },
          'DUPLICATE_ENTRY'
        );
      }
      case 'P2025':
        return sendError(
          res,
          'The requested clinical record was not found or has been modified.',
          404,
          undefined,
          'RECORD_NOT_FOUND'
        );
      default:
        return sendError(
          res,
          env.NODE_ENV === 'production'
            ? 'A database error occurred while processing the clinical request.'
            : `Database error (${err.code}): ${err.message}`,
          500,
          undefined,
          'DATABASE_ERROR'
        );
    }
  }

  // 3. Malformed JSON payload
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    return sendError(res, 'Malformed JSON payload received', 400, undefined, 'MALFORMED_JSON');
  }

  // 4. Fallback unhandled server error
  return sendError(
    res,
    env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please contact system engineering.'
      : err.message,
    500,
    env.NODE_ENV === 'development' ? { stack: err.stack } : undefined,
    'INTERNAL_SERVER_ERROR'
  );
}

