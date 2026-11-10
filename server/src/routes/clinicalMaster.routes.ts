import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getReferringDoctors,
  getExamDefinitions,
  getEquipment,
} from '../controllers/clinicalMaster.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);
router.use(requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST));

router.get('/referring-doctors', asyncHandler(getReferringDoctors));
router.get('/exam-definitions', asyncHandler(getExamDefinitions));
router.get('/equipment', asyncHandler(getEquipment));

export default router;

