import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getPatients,
  getPatient,
  create,
  update,
  checkDuplicate,
  generateIdPreview,
  patientQuerySchema,
  createPatientSchema,
  updatePatientSchema,
  duplicateCheckSchema,
} from '../controllers/patient.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All clinical patient routes require authentication
router.use(authenticate);

// GET /api/v1/patients - List patients with pagination & search
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  validateRequest({ query: patientQuerySchema }),
  asyncHandler(getPatients)
);

// GET /api/v1/patients/generate-id - Preview unique persistent Patient ID
router.get(
  '/generate-id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(generateIdPreview)
);

// POST /api/v1/patients/duplicate-check - Detect likely duplicate candidates
router.post(
  '/duplicate-check',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: duplicateCheckSchema }),
  asyncHandler(checkDuplicate)
);

// POST /api/v1/patients - Register new patient with persistent MRN
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: createPatientSchema }),
  asyncHandler(create)
);

// GET /api/v1/patients/:id - Retrieve patient details and clinical history
router.get(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getPatient)
);

// PATCH /api/v1/patients/:id - Update patient demographics
router.patch(
  '/:id',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ body: updatePatientSchema }),
  asyncHandler(update)
);

export default router;
