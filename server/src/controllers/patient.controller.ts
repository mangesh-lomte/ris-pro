import { Request, Response } from 'express';
import { z } from 'zod';
import { Gender } from '@prisma/client';
import {
  createPatient,
  getPatientById,
  updatePatient,
  listPatients,
  findDuplicatePatients,
} from '../services/patient.service';
import { generatePatientId } from '../utils/identifierGenerator';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export const patientQuerySchema = z.object({
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  sortBy: z.enum(['createdAt', 'lastName', 'firstName']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

export const createPatientSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'First name must be at least 2 characters')
    .max(100, 'First name cannot exceed 100 characters'),
  middleName: z.string().trim().max(100).optional(),
  lastName: z
    .string()
    .trim()
    .min(1, 'Last name must be at least 1 character')
    .max(100, 'Last name cannot exceed 100 characters'),
  dateOfBirth: z
    .string()
    .refine((val) => !isNaN(Date.parse(val)), 'Valid ISO date of birth is required')
    .refine((val) => new Date(val) <= new Date(), 'Date of birth cannot be in the future'),
  gender: z.nativeEnum(Gender, {
    errorMap: () => ({ message: 'Valid gender selection required (MALE, FEMALE, OTHER, UNKNOWN)' }),
  }),
  phone: z
    .string()
    .trim()
    .min(5, 'Phone number must be at least 5 digits')
    .max(25, 'Phone number cannot exceed 25 characters'),
  alternatePhone: z.string().trim().max(25).optional(),
  email: z.string().trim().email('Invalid email address format').optional().or(z.literal('')),
  addressLine1: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  postalCode: z.string().trim().max(20).optional(),
  emergencyContactName: z.string().trim().max(100).optional(),
  emergencyContactPhone: z.string().trim().max(25).optional(),
  emergencyContactRelation: z.string().trim().max(50).optional(),
  bypassDuplicateWarning: z.boolean().optional(),
});

export const updatePatientSchema = createPatientSchema.partial().omit({ bypassDuplicateWarning: true }).extend({
  isActive: z.boolean().optional(),
});

export const duplicateCheckSchema = z.object({
  phone: z.string().trim().min(5),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  dateOfBirth: z.string().refine((val) => !isNaN(Date.parse(val))),
});

export async function getPatients(req: Request, res: Response): Promise<Response> {
  const page = typeof req.query.page === 'number' ? req.query.page : 1;
  const pageSize =
    typeof req.query.pageSize === 'number'
      ? req.query.pageSize
      : typeof req.query.limit === 'number'
      ? req.query.limit
      : 20;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;
  const sortBy = req.query.sortBy as string | undefined;
  const sortOrder = req.query.sortOrder as 'asc' | 'desc' | undefined;

  const result = await listPatients({ page, pageSize, search, sortBy, sortOrder });
  return sendSuccess(res, result, 'Patients retrieved successfully');
}

export async function getPatient(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Patient ID parameter is required');

  const patient = await getPatientById(id);
  return sendSuccess(res, patient, 'Patient record retrieved');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const patient = await createPatient(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, patient, 'Patient registered successfully with persistent MRN', 201);
}

export async function update(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Patient ID parameter is required');

  const patient = await updatePatient(id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, patient, 'Patient demographics updated successfully');
}

export async function checkDuplicate(req: Request, res: Response): Promise<Response> {
  const { phone, firstName, lastName, dateOfBirth } = req.body;
  const duplicates = await findDuplicatePatients({
    phone,
    firstName,
    lastName,
    dateOfBirth: new Date(dateOfBirth),
  });

  return sendSuccess(
    res,
    {
      hasPotentialDuplicates: duplicates.length > 0,
      count: duplicates.length,
      candidates: duplicates,
    },
    duplicates.length > 0 ? 'Possible existing patient matches found' : 'No duplicates detected'
  );
}

export async function generateIdPreview(_req: Request, res: Response): Promise<Response> {
  const patientId = generatePatientId();
  return sendSuccess(
    res,
    { patientId, format: 'PAT-YYYY-XXXXX', description: 'Persistent Master Patient Index identifier' },
    'Generated persistent Patient ID'
  );
}
