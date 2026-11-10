import { Request, Response } from 'express';
import { z } from 'zod';
import { loginUser } from '../services/auth.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export const loginSchema = z.object({
  email: z.string().email('Please provide a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function login(req: Request, res: Response): Promise<Response> {
  const result = await loginUser({
    email: req.body.email,
    password: req.body.password,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, result, 'Authentication successful');
}

export async function getMe(req: Request, res: Response): Promise<Response> {
  if (!req.user) {
    throw AppError.unauthorized('User not authenticated');
  }

  return sendSuccess(res, req.user, 'Current user profile retrieved');
}

