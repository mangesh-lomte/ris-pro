import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import {
  getReceivedStudies,
  getViewerLaunch,
  getPriorStudies,
  routeStudy,
  getStorageTiers,
  getCapacityMonitor,
  importExternalMedia,
  exportStudy,
  checkCompleteness,
  getNodesMonitor,
} from '../controllers/pacsManagement.controller';

const router = Router();

// Require authenticated clinical/admin access for all PACS management routes
router.use(authenticate);

// 1. Received studies worklist: Clinicians (Admin, Radiologist, Technologist)
router.get(
  '/studies',
  requireRole(UserRole.ADMIN, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  asyncHandler(getReceivedStudies)
);

// 2. DICOM viewer launch context: Clinicians (Admin, Radiologist, Technologist)
router.get(
  '/viewer/:studyUid',
  requireRole(UserRole.ADMIN, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  asyncHandler(getViewerLaunch)
);

// 3. Prior study auto-matching: Clinicians (Admin, Radiologist, Technologist)
router.get(
  '/priors/:identifier',
  requireRole(UserRole.ADMIN, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  asyncHandler(getPriorStudies)
);

// 4. DICOM routing rules: Clinical and administrative routing (Admin, Radiologist, Technologist)
router.post(
  '/route/:identifier',
  requireRole(UserRole.ADMIN, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  asyncHandler(routeStudy)
);

// 5. Storage & archive status: Administrative telemetry (Admin only)
router.get(
  '/storage/tiers',
  requireRole(UserRole.ADMIN),
  asyncHandler(getStorageTiers)
);

// 6. Storage capacity monitor: Administrative storage gauge (Admin only)
router.get(
  '/storage/capacity',
  requireRole(UserRole.ADMIN),
  asyncHandler(getCapacityMonitor)
);

// 7. DICOM import from external media: Technologists and Admins ingesting CDs/USB brought by patient
router.post(
  '/import-media',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(importExternalMedia)
);

// 8. DICOM export / anonymize: Radiologists and Admins exporting for research/second opinion
router.post(
  '/export/:studyUid',
  requireRole(UserRole.ADMIN, UserRole.RADIOLOGIST),
  asyncHandler(exportStudy)
);

// 9. Study integrity / completeness: Clinicians verifying series/instances (Admin, Radiologist, Technologist)
router.get(
  '/completeness/:studyUid',
  requireRole(UserRole.ADMIN, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  asyncHandler(checkCompleteness)
);

// 10. PACS server connectivity monitor: Infrastructure telemetry (Admin only)
router.get(
  '/nodes/connectivity',
  requireRole(UserRole.ADMIN),
  asyncHandler(getNodesMonitor)
);

export default router;

