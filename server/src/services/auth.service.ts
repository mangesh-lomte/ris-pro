import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/db';
import { env } from '../config/env';
import { AppError } from '../utils/appError';
import { AuthUser, JwtPayload } from '../types/api.types';
import { logAuditEvent } from './audit.service';

export interface LoginParams {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuthResponseData {
  token: string;
  user: AuthUser;
}

export async function loginUser(params: LoginParams): Promise<AuthResponseData> {
  const normalizedEmail = params.email.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    throw AppError.unauthorized('Invalid email or password credentials', 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    throw AppError.forbidden('User account is currently disabled. Contact administrator.', 'ACCOUNT_DISABLED');
  }

  const isPasswordValid = await bcrypt.compare(params.password, user.passwordHash);
  if (!isPasswordValid) {
    throw AppError.unauthorized('Invalid email or password credentials', 'INVALID_CREDENTIALS');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const signOptions: SignOptions = {
    expiresIn: 28800, // 8 hours in seconds
  };

  const token = jwt.sign(payload, env.JWT_SECRET, signOptions);

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    isActive: user.isActive,
  };

  // Record audit log
  await logAuditEvent({
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'User',
    entityId: user.id,
    details: { role: user.role, email: user.email },
    ipAddress: params.ipAddress,
    userAgent: params.userAgent,
  });

  return { token, user: authUser };
}
