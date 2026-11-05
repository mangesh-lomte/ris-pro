import { Router } from 'express';
import { getPatients, generateIdPreview, patientQuerySchema } from '../controllers/patient.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// All clinical patient routes require authentication
router.use(authenticate);

// GET /api/v1/patients - List patients with pagination & search
router.get('/', validateRequest({ query: patientQuerySchema }), asyncHandler(getPatients));

// GET /api/v1/patients/generate-id - Preview unique persistent Patient ID
router.get('/generate-id', asyncHandler(generateIdPreview));

export default router;
