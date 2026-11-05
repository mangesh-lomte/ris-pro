import { Response } from 'express';
import { ApiResponse, ApiErrorResponse, PaginationMeta } from '../types/api.types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200,
  meta?: PaginationMeta
): Response {
  const response: ApiResponse<T> = {
    success: true,
    ...(message ? { message } : {}),
    data,
    ...(meta ? { meta } : {}),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  message: string,
  statusCode: number = 500,
  details?: unknown,
  code?: string
): Response {
  const response: ApiErrorResponse = {
    success: false,
    message,
    ...(details || code
      ? {
          error: {
            ...(code ? { code } : {}),
            ...(details ? { details } : {}),
          },
        }
      : {}),
    timestamp: new Date().toISOString(),
  };

  return res.status(statusCode).json(response);
}
