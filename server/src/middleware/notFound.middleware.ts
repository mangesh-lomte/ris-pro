import { Request, Response } from 'express';
import { sendError } from '../utils/apiResponse';

export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(
    res,
    `Clinical route not found: ${req.method} ${req.originalUrl}`,
    404,
    undefined,
    'ROUTE_NOT_FOUND'
  );
}

