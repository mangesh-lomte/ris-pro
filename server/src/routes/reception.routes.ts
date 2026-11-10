import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { getQueue } from '../controllers/appointment.controller';
import {
  getReceptionReadyReportsHandler,
  recordDeliveryAcknowledgmentHandler,
  sendPatientNotificationHandler,
  recordReportReprintHandler,
  printReportPdfHandler,
  getReportDeliveryHistoryHandler,
} from '../controllers/reportDelivery.controller';
import {
  registerWalkInHandler,
  recordConsentHandler,
  getConsentHandler,
  getAppointmentSlipHandler,
  getOrderBillingHandler,
  recordOrderPaymentHandler,
} from '../controllers/reception.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

router.use(authenticate);

// ==========================================
// Module 03 — Reception / Front Desk Core Workflows
// ==========================================

// 03.4 Walk-in registration: Create urgent or non-booked scan orders with immediate token issuance
router.post(
  '/walk-in',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(registerWalkInHandler)
);

// 03.8 Active checked-in patients waiting queue
router.get(
  '/queue',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(getQueue)
);

// 03.9 Consent and forms: Record & view signed consent copies under audit control
router.post(
  '/orders/:id/consent',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(recordConsentHandler)
);
router.get(
  '/orders/:id/consent',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getConsentHandler)
);

// 03.11 Patient instructions & appointment slip printing
router.get(
  '/appointments/:id/slip',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getAppointmentSlipHandler)
);

// 03.12 Payment status & collection: Due, paid, refund, and part-payment
router.get(
  '/orders/:id/billing',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getOrderBillingHandler)
);
router.post(
  '/orders/:id/payments',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(recordOrderPaymentHandler)
);

// ==========================================
// Phase 4.11 — Report Delivery & Front Desk
// ==========================================

// GET /api/v1/reception/reports/ready - List finalized reports marked ready for front desk
router.get(
  '/reports/ready',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(getReceptionReadyReportsHandler)
);

// POST /api/v1/reception/reports/:id/handover - Record physical delivery / handover acknowledgment
router.post(
  '/reports/:id/handover',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(recordDeliveryAcknowledgmentHandler)
);

// POST /api/v1/reception/reports/:id/notify - Trigger patient SMS / email notification
router.post(
  '/reports/:id/notify',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(sendPatientNotificationHandler)
);

// POST /api/v1/reception/reports/:id/reprint - Record reprint event with reason & copy count
router.post(
  '/reports/:id/reprint',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(recordReportReprintHandler)
);

// GET /api/v1/reception/reports/:id/print-pdf - Download/stream report PDF with automatic reprint logging
router.get(
  '/reports/:id/print-pdf',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION),
  asyncHandler(printReportPdfHandler)
);

// GET /api/v1/reception/reports/:id/deliveries - View complete delivery history for an order
router.get(
  '/reports/:id/deliveries',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.RADIOLOGIST),
  asyncHandler(getReportDeliveryHistoryHandler)
);

export default router;
