import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getAvailability, slotAvailabilitySchema } from '../controllers/appointment.controller';
import { validateRequest } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// GET /api/v1/scheduling/availability - Calculate real-time machine slot availability
router.get(
  '/availability',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  validateRequest({ query: slotAvailabilitySchema }),
  asyncHandler(getAvailability)
);

export default router;

