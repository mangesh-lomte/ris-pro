import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getWorklistHandler,
  getStudyContextHandler,
  claimStudyHandler,
  assignStudyHandler,
  releaseStudyHandler,
  listRadiologistsHandler,
  getViewerLaunchHandler,
  getPriorStudiesHandler,
  getPriorReportHandler,
  getReportWorkspaceHandler,
  createReportDraftHandler,
  saveReportDraftHandler,
  autosaveReportDraftHandler,
  recordDictationEventHandler,
  getStudyInstancesHandler,
  saveMeasurementHandler,
  getMeasurementsHandler,
  deleteMeasurementHandler,
  toggleKeyImageHandler,
  saveMeasurementBodySchema,
  radiologistWorklistQuerySchema,
  assignRadiologistSchema,
  createReportDraftSchema,
  updateReportDraftSchema,
  recordDictationEventSchema,
} from '../controllers/radiologist.controller';
import {
  requestPeerReviewHandler,
  getPeerReviewQueueHandler,
  getPeerReviewContextHandler,
  claimPeerReviewHandler,
  submitPeerReviewHandler,
  cancelPeerReviewHandler,
  getOrderPeerReviewHandler,
  requestPeerReviewSchema,
  peerReviewQueueQuerySchema,
  submitPeerReviewSchema,
} from '../controllers/peerReview.controller';
import {
  createCriticalFindingHandler,
  getCriticalFindingQueueHandler,
  getCriticalFindingByIdHandler,
  getOrderCriticalFindingHandler,
  acknowledgeCriticalFindingHandler,
  getActiveCliniciansHandler,
  createCriticalFindingSchema,
  acknowledgeCriticalFindingSchema,
} from '../controllers/criticalFinding.controller';
import {
  getReportVersionHistoryHandler,
  createReportAmendmentHandler,
} from '../controllers/reportAmendment.controller';
import {
  getReportReviewSummaryHandler,
  finalizeAndSignReportHandler,
  finalizeReportSchema,
} from '../controllers/reportFinalization.controller';
import {
  generateReportPdfHandler,
  getReportPdfHandler,
} from '../controllers/reportPdf.controller';
import {
  sendReportToReceptionHandler,
} from '../controllers/reportDelivery.controller';
import {
  getOrderDocumentsHandler,
  downloadOrderDocumentHandler,
} from '../controllers/technologist.controller';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Protect all radiologist routes with JWT authentication & role-based access control
router.use(authenticate);
router.use(requireRole(UserRole.RADIOLOGIST, UserRole.ADMIN));

// GET /api/v1/radiologist/worklist
router.get(
  '/worklist',
  validateRequest({ query: radiologistWorklistQuerySchema }),
  asyncHandler(getWorklistHandler)
);

// GET /api/v1/radiologist/radiologists (for admin assignment dropdown)
router.get(
  '/radiologists',
  asyncHandler(listRadiologistsHandler)
);

// GET /api/v1/radiologist/worklist/:id
router.get(
  '/worklist/:id',
  asyncHandler(getStudyContextHandler)
);

// GET /api/v1/radiologist/worklist/:id/viewer-launch
router.get(
  '/worklist/:id/viewer-launch',
  asyncHandler(getViewerLaunchHandler)
);

// GET /api/v1/radiologist/worklist/:id/priors
router.get(
  '/worklist/:id/priors',
  asyncHandler(getPriorStudiesHandler)
);

// GET /api/v1/radiologist/worklist/:id/documents (read-only view)
router.get(
  '/worklist/:id/documents',
  asyncHandler(getOrderDocumentsHandler)
);

// GET /api/v1/radiologist/worklist/:id/documents/:docId/download (read-only download)
router.get(
  ['/worklist/:id/documents/:docId/download', '/worklist/:id/documents/:docId/view', '/worklist/:id/documents/:docId'],
  asyncHandler(downloadOrderDocumentHandler)
);

// GET /api/v1/radiologist/worklist/:id/priors/:priorId/report
router.get(
  '/worklist/:id/priors/:priorId/report',
  asyncHandler(getPriorReportHandler)
);

// POST /api/v1/radiologist/worklist/:id/claim (Radiologists claim unassigned study)
router.post(
  '/worklist/:id/claim',
  requireRole(UserRole.RADIOLOGIST),
  asyncHandler(claimStudyHandler)
);

// POST /api/v1/radiologist/worklist/:id/assign (Admins assign study to a radiologist)
router.post(
  '/worklist/:id/assign',
  requireRole(UserRole.ADMIN),
  validateRequest({ body: assignRadiologistSchema }),
  asyncHandler(assignStudyHandler)
);

// POST /api/v1/radiologist/worklist/:id/release (Radiologist releases own assignment, or Admin releases)
router.post(
  '/worklist/:id/release',
  asyncHandler(releaseStudyHandler)
);

// GET /api/v1/radiologist/worklist/:id/report (Reporting workspace context)
router.get(
  '/worklist/:id/report',
  asyncHandler(getReportWorkspaceHandler)
);

// GET /api/v1/radiologist/worklist/:id/study-instances (DICOM series and instances for references)
router.get(
  '/worklist/:id/study-instances',
  asyncHandler(getStudyInstancesHandler)
);

// POST /api/v1/radiologist/worklist/:id/report/draft (Create initial draft from template)
router.post(
  '/worklist/:id/report/draft',
  validateRequest({ body: createReportDraftSchema }),
  asyncHandler(createReportDraftHandler)
);

// PATCH /api/v1/radiologist/worklist/:id/report/draft (Manual save draft)
router.patch(
  '/worklist/:id/report/draft',
  validateRequest({ body: updateReportDraftSchema }),
  asyncHandler(saveReportDraftHandler)
);

// PUT /api/v1/radiologist/worklist/:id/report/draft (Manual save draft alias)
router.put(
  '/worklist/:id/report/draft',
  validateRequest({ body: updateReportDraftSchema }),
  asyncHandler(saveReportDraftHandler)
);

// POST /api/v1/radiologist/worklist/:id/report/draft/autosave (Autosave draft)
router.post(
  '/worklist/:id/report/draft/autosave',
  validateRequest({ body: updateReportDraftSchema }),
  asyncHandler(autosaveReportDraftHandler)
);

// POST /api/v1/radiologist/worklist/:id/report/dictation/session (Audit dictation lifecycle)
router.post(
  '/worklist/:id/report/dictation/session',
  validateRequest({ body: recordDictationEventSchema }),
  asyncHandler(recordDictationEventHandler)
);

// ==========================================
// Dedicated Study Measurements & Key Images Integration
// ==========================================

// GET /api/v1/radiologist/worklist/:id/measurements
router.get(
  '/worklist/:id/measurements',
  asyncHandler(getMeasurementsHandler)
);

// POST /api/v1/radiologist/worklist/:id/measurements
router.post(
  '/worklist/:id/measurements',
  validateRequest({ body: saveMeasurementBodySchema }),
  asyncHandler(saveMeasurementHandler)
);

// DELETE /api/v1/radiologist/worklist/:id/measurements/:measurementId
router.delete(
  '/worklist/:id/measurements/:measurementId',
  asyncHandler(deleteMeasurementHandler)
);

// POST /api/v1/radiologist/worklist/:id/measurements/:measurementId/toggle-key-image
router.post(
  '/worklist/:id/measurements/:measurementId/toggle-key-image',
  asyncHandler(toggleKeyImageHandler)
);

// ==========================================
// Phase 4.8 — Report Corrections & Addenda
// ==========================================

const createReportAmendmentSchema = z.object({
  amendmentType: z.enum(['CORRECTION', 'ADDENDUM']),
  reason: z.string().min(1, 'Amendment reason is required'),
  content: z.string().optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  targetVersion: z.number().int().min(1, 'targetVersion is required for concurrency check'),
});

// GET /api/v1/radiologist/worklist/:id/report/version-history
router.get(
  '/worklist/:id/report/version-history',
  asyncHandler(getReportVersionHistoryHandler)
);

// POST /api/v1/radiologist/worklist/:id/report/amendments
router.post(
  '/worklist/:id/report/amendments',
  validateRequest({ body: createReportAmendmentSchema }),
  asyncHandler(createReportAmendmentHandler)
);

// ==========================================
// Phase 4.9 — Final Report Review, Sign & Lock
// ==========================================

// GET /api/v1/radiologist/worklist/:id/report/review (Review summary and completeness check)
router.get(
  '/worklist/:id/report/review',
  asyncHandler(getReportReviewSummaryHandler)
);

// POST /api/v1/radiologist/worklist/:id/report/finalize (Authorize, apply digital signature, sign and lock)
router.post(
  '/worklist/:id/report/finalize',
  validateRequest({ body: finalizeReportSchema }),
  asyncHandler(finalizeAndSignReportHandler)
);

// ==========================================
// Phase 4.10 — PDF Report Generation
// ==========================================

// POST /api/v1/radiologist/worklist/:id/report/pdf (Generate authoritative clinical PDF)
router.post(
  '/worklist/:id/report/pdf',
  asyncHandler(generateReportPdfHandler)
);

// GET /api/v1/radiologist/worklist/:id/report/pdf (Retrieve/stream clinical PDF)
router.get(
  '/worklist/:id/report/pdf',
  asyncHandler(getReportPdfHandler)
);

// ==========================================
// Phase 4.11 — Report Delivery (Send to Reception)
// ==========================================

// POST /api/v1/radiologist/worklist/:id/report/send-to-reception (Mark ready for front-desk delivery)
router.post(
  '/worklist/:id/report/send-to-reception',
  asyncHandler(sendReportToReceptionHandler)
);

// ==========================================
// Phase 4.6 — Peer Review / Second Opinion
// ==========================================

// POST /api/v1/radiologist/peer-reviews (Create Peer Review Request)
router.post(
  '/peer-reviews',
  validateRequest({ body: requestPeerReviewSchema }),
  asyncHandler(requestPeerReviewHandler)
);

// GET /api/v1/radiologist/peer-reviews (Peer Review Worklist Queue)
router.get(
  '/peer-reviews',
  validateRequest({ query: peerReviewQueueQuerySchema }),
  asyncHandler(getPeerReviewQueueHandler)
);

// GET /api/v1/radiologist/peer-reviews/:id (Peer Review Study Context)
router.get(
  '/peer-reviews/:id',
  asyncHandler(getPeerReviewContextHandler)
);

// POST /api/v1/radiologist/peer-reviews/:id/claim (Reviewer claims request)
router.post(
  '/peer-reviews/:id/claim',
  asyncHandler(claimPeerReviewHandler)
);

// POST /api/v1/radiologist/peer-reviews/:id/submit (Reviewer submits second opinion)
router.post(
  '/peer-reviews/:id/submit',
  validateRequest({ body: submitPeerReviewSchema }),
  asyncHandler(submitPeerReviewHandler)
);

// POST /api/v1/radiologist/peer-reviews/:id/cancel (Requester/Admin cancels request)
router.post(
  '/peer-reviews/:id/cancel',
  asyncHandler(cancelPeerReviewHandler)
);

// GET /api/v1/radiologist/worklist/:id/peer-review (Get peer review status for study)
router.get(
  '/worklist/:id/peer-review',
  asyncHandler(getOrderPeerReviewHandler)
);

// ==========================================
// Phase 4.7 — Critical Findings Alerts
// ==========================================

// GET /api/v1/radiologist/clinicians (Eligible clinicians list)
router.get(
  '/clinicians',
  asyncHandler(getActiveCliniciansHandler)
);

// POST /api/v1/radiologist/critical-findings (Create & send critical finding alert)
router.post(
  '/critical-findings',
  validateRequest({ body: createCriticalFindingSchema }),
  asyncHandler(createCriticalFindingHandler)
);

// GET /api/v1/radiologist/critical-findings (Critical findings queue / inbox)
router.get(
  '/critical-findings',
  asyncHandler(getCriticalFindingQueueHandler)
);

// GET /api/v1/radiologist/critical-findings/:id (Critical finding details)
router.get(
  '/critical-findings/:id',
  asyncHandler(getCriticalFindingByIdHandler)
);

// POST /api/v1/radiologist/critical-findings/:id/acknowledge (Acknowledge critical alert)
router.post(
  '/critical-findings/:id/acknowledge',
  validateRequest({ body: acknowledgeCriticalFindingSchema }),
  asyncHandler(acknowledgeCriticalFindingHandler)
);

// GET /api/v1/radiologist/worklist/:orderId/critical-finding (Study's active critical finding)
router.get(
  '/worklist/:orderId/critical-finding',
  asyncHandler(getOrderCriticalFindingHandler)
);

export default router;

