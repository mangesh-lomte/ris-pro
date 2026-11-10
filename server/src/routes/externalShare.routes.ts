import { Router } from 'express';
import { ExternalShareController } from '../controllers/externalShare.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { UserRole } from '@prisma/client';

const router = Router();

// ============================================================================
// PUBLIC / RECIPIENT ACCESS ENDPOINTS (SECURED VIA SHARE TOKEN & OTP)
// ============================================================================

// Verify recipient OTP
router.post('/:token/verify-otp', ExternalShareController.verifyOtp);

// View study metadata & viewer launch context
router.get('/:token/context', ExternalShareController.getSharedContext);

// Download finalized PDF report
router.get('/:token/report-pdf', ExternalShareController.getSharedReportPdf);

// Download DICOM package ZIP
router.get('/:token/dicom-package', ExternalShareController.getSharedDicomPackage);

// ============================================================================
// AUTHENTICATED INTERNAL RIS ENDPOINTS (RBAC PROTECTED)
// ============================================================================

// All routes below require valid staff credentials
router.use(authenticate);

// List shares
router.get(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  ExternalShareController.listShares
);

// Create external share
router.post(
  '/',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.RADIOLOGIST, UserRole.TECHNOLOGIST),
  ExternalShareController.createShare
);

// Revoke share
router.post(
  '/:id/revoke',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.RADIOLOGIST),
  ExternalShareController.revokeShare
);

// Record consent
router.post(
  '/:id/consent',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  ExternalShareController.recordConsent
);

// Share access logs
router.get(
  ['/logs', '/:id/logs'],
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  ExternalShareController.getShareLogs
);

// Large file transfers
router.get(
  ['/transfers', '/transfers/list'],
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  ExternalShareController.listTransfers
);

router.post(
  '/transfers/initiate',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  ExternalShareController.initiateTransfer
);

router.post(
  '/transfers/:id/retry',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  ExternalShareController.retryTransfer
);

// Outside DICOM study imports
router.get(
  ['/imports', '/imports/list'],
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  ExternalShareController.listImports
);

router.post(
  '/imports/receive',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RECEPTION),
  ExternalShareController.receiveImport
);

router.post(
  '/imports/:id/reconcile',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  ExternalShareController.reconcileImport
);

export default router;
