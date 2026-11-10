import { AuthUser } from './api.types';
import { Patient, ReferringDoctor } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      correlationId?: string;
      patient?: Patient;
      referringDoctor?: ReferringDoctor;
    }
  }
}

export {};
