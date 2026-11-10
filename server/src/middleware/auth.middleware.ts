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

    if (!decoded || !decoded.userId) {
      throw AppError.unauthorized('Invalid authentication token: missing user identity', 'INVALID_TOKEN');
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

export async function authenticatePatient(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('Bearer token not provided');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw AppError.unauthorized('Invalid or expired authentication token', 'TOKEN_EXPIRED');
    }

    if (decoded.role !== 'PATIENT' || !decoded.patientId) {
      throw AppError.forbidden('Access denied. Token is not authorized for patient portal.', 'FORBIDDEN_ROLE');
    }

    const patient = await prisma.patient.findUnique({
      where: { patientId: decoded.patientId },
    });

    if (!patient || !patient.isActive) {
      throw AppError.unauthorized('Patient account not found or inactive', 'PATIENT_NOT_FOUND');
    }

    req.patient = patient;
    next();
  } catch (error) {
    next(error);
  }
}

export async function authenticateReferringDoctor(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      throw AppError.unauthorized('Bearer token not provided');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw AppError.unauthorized('Invalid or expired authentication token', 'TOKEN_EXPIRED');
    }

    if (decoded.role !== 'REFERRING_DOCTOR' || !decoded.doctorId) {
      throw AppError.forbidden('Access denied. Token is not authorized for referring doctor portal.', 'FORBIDDEN_ROLE');
    }

    const doctor = await prisma.referringDoctor.findUnique({
      where: { id: decoded.doctorId },
    });

    if (!doctor || !doctor.isActive) {
      throw AppError.unauthorized('Referring doctor account not found or inactive', 'DOCTOR_NOT_FOUND');
    }

    req.referringDoctor = doctor;
    next();
  } catch (error) {
    next(error);
  }
}


