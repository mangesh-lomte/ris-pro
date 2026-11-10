import { Router } from 'express';
import { UserRole } from '@prisma/client';
import {
  getWorklist,
  getWorklistItem,
  getSafetyScreening,
  saveSafetyScreeningHandler,
  saveSafetyScreeningSchema,
  technologistWorklistQuerySchema,
  getPreparationHandler,
  savePreparationHandler,
  savePreparationSchema,
  confirmProtocolHandler,
  confirmProtocolSchema,
  getScanHandler,
  startScanHandler,
  startScanSchema,
  interruptScanHandler,
  interruptScanSchema,
  resumeScanHandler,
  finishScanHandler,
  cancelScanHandler,
  cancelScanSchema,
  getContrastHandler,
  recordContrastHandler,
  recordContrastSchema,
  getIncidentsHandler,
  recordIncidentHandler,
  recordIncidentSchema,
  getImageQualityHandler,
  startImageQualityHandler,
  acceptImageQualityHandler,
  acceptImageQualitySchema,
  repeatRequiredHandler,
  repeatRequiredSchema,
  rejectImageQualityHandler,
  rejectImageQualitySchema,
  authorizeRepeatHandler,
  getPacsHandoffHandler,
  initiatePacsHandoffHandler,
  retryPacsHandoffHandler,
  getPacsStatusHandler,
  lookupPacsStudyHandler,
  reconcilePacsStudyHandler,
  uploadOrderDocumentHandler,
  uploadOrderDocumentSchema,
  getOrderDocumentsHandler,
  downloadOrderDocumentHandler,
  deleteOrderDocumentHandler,
} from '../controllers/technologist.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { validateRequest } from '../middleware/validate.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Protect all technologist routes with JWT authentication & role-based access control
router.use(authenticate);
router.use(requireRole(UserRole.TECHNOLOGIST, UserRole.ADMIN));

// GET /api/v1/technologist/worklist
router.get(
  '/worklist',
  validateRequest({ query: technologistWorklistQuerySchema }),
  asyncHandler(getWorklist)
);

// GET /api/v1/technologist/worklist/:id
router.get(
  '/worklist/:id',
  asyncHandler(getWorklistItem)
);

// GET /api/v1/technologist/worklist/:id/safety
router.get(
  ['/worklist/:id/safety', '/worklist/:id/safety-screening'],
  asyncHandler(getSafetyScreening)
);

// POST /api/v1/technologist/worklist/:id/safety
router.post(
  ['/worklist/:id/safety', '/worklist/:id/safety-screening'],
  validateRequest({ body: saveSafetyScreeningSchema }),
  asyncHandler(saveSafetyScreeningHandler)
);

// GET /api/v1/technologist/worklist/:id/preparation
router.get(
  '/worklist/:id/preparation',
  asyncHandler(getPreparationHandler)
);

// PUT /api/v1/technologist/worklist/:id/preparation
router.put(
  '/worklist/:id/preparation',
  validateRequest({ body: savePreparationSchema }),
  asyncHandler(savePreparationHandler)
);

// POST /api/v1/technologist/worklist/:id/preparation (alternative REST alias)
router.post(
  '/worklist/:id/preparation',
  validateRequest({ body: savePreparationSchema }),
  asyncHandler(savePreparationHandler)
);

// POST /api/v1/technologist/worklist/:id/protocol
router.post(
  ['/worklist/:id/protocol', '/worklist/:id/protocol/confirm'],
  validateRequest({ body: confirmProtocolSchema }),
  asyncHandler(confirmProtocolHandler)
);

// GET /api/v1/technologist/worklist/:id/scan
router.get(
  '/worklist/:id/scan',
  asyncHandler(getScanHandler)
);

// POST /api/v1/technologist/worklist/:id/scan/start
router.post(
  '/worklist/:id/scan/start',
  validateRequest({ body: startScanSchema }),
  asyncHandler(startScanHandler)
);

// POST /api/v1/technologist/worklist/:id/scan/interrupt
router.post(
  '/worklist/:id/scan/interrupt',
  validateRequest({ body: interruptScanSchema }),
  asyncHandler(interruptScanHandler)
);

// POST /api/v1/technologist/worklist/:id/scan/resume
router.post(
  '/worklist/:id/scan/resume',
  asyncHandler(resumeScanHandler)
);

// POST /api/v1/technologist/worklist/:id/scan/finish
router.post(
  '/worklist/:id/scan/finish',
  asyncHandler(finishScanHandler)
);

// POST /api/v1/technologist/worklist/:id/scan/cancel
router.post(
  '/worklist/:id/scan/cancel',
  validateRequest({ body: cancelScanSchema }),
  asyncHandler(cancelScanHandler)
);

// GET /api/v1/technologist/worklist/:id/contrast
router.get(
  '/worklist/:id/contrast',
  asyncHandler(getContrastHandler)
);

// POST /api/v1/technologist/worklist/:id/contrast
router.post(
  '/worklist/:id/contrast',
  validateRequest({ body: recordContrastSchema }),
  asyncHandler(recordContrastHandler)
);

// GET /api/v1/technologist/worklist/:id/incidents
router.get(
  '/worklist/:id/incidents',
  asyncHandler(getIncidentsHandler)
);

// POST /api/v1/technologist/worklist/:id/incidents
router.post(
  '/worklist/:id/incidents',
  validateRequest({ body: recordIncidentSchema }),
  asyncHandler(recordIncidentHandler)
);

// ==========================================
// PHASE 3.6: IMAGE QUALITY & PACS HANDOFF
// ==========================================

// GET /api/v1/technologist/worklist/:id/image-quality (or /qa)
router.get(
  ['/worklist/:id/image-quality', '/worklist/:id/qa'],
  asyncHandler(getImageQualityHandler)
);

// POST /api/v1/technologist/worklist/:id/image-quality/start (or /qa/start)
router.post(
  ['/worklist/:id/image-quality/start', '/worklist/:id/qa/start'],
  asyncHandler(startImageQualityHandler)
);

// POST /api/v1/technologist/worklist/:id/image-quality/accept (or /qa/accept)
router.post(
  ['/worklist/:id/image-quality/accept', '/worklist/:id/qa/accept'],
  validateRequest({ body: acceptImageQualitySchema }),
  asyncHandler(acceptImageQualityHandler)
);

// POST /api/v1/technologist/worklist/:id/image-quality/repeat-required (or /qa/repeat-required)
router.post(
  ['/worklist/:id/image-quality/repeat-required', '/worklist/:id/qa/repeat-required'],
  validateRequest({ body: repeatRequiredSchema }),
  asyncHandler(repeatRequiredHandler)
);

// POST /api/v1/technologist/worklist/:id/image-quality/reject (or /qa/reject)
router.post(
  ['/worklist/:id/image-quality/reject', '/worklist/:id/qa/reject'],
  validateRequest({ body: rejectImageQualitySchema }),
  asyncHandler(rejectImageQualityHandler)
);

// POST /api/v1/technologist/worklist/:id/image-quality/authorize-repeat (or /repeat-authorize)
router.post(
  [
    '/worklist/:id/image-quality/authorize-repeat',
    '/worklist/:id/image-quality/repeat-authorize',
    '/worklist/:id/qa/authorize-repeat',
    '/worklist/:id/qa/repeat-authorize',
  ],
  asyncHandler(authorizeRepeatHandler)
);

// GET /api/v1/technologist/worklist/:id/pacs-handoff (or /pacs)
router.get(
  ['/worklist/:id/pacs-handoff', '/worklist/:id/pacs'],
  asyncHandler(getPacsHandoffHandler)
);

// POST /api/v1/technologist/worklist/:id/pacs-handoff/initiate (or /pacs/initiate)
router.post(
  ['/worklist/:id/pacs-handoff/initiate', '/worklist/:id/pacs/initiate'],
  asyncHandler(initiatePacsHandoffHandler)
);

// POST /api/v1/technologist/worklist/:id/pacs-handoff/retry (or /pacs/retry)
router.post(
  ['/worklist/:id/pacs-handoff/retry', '/worklist/:id/pacs/retry'],
  asyncHandler(retryPacsHandoffHandler)
);

// ==========================================
// PHASE 3.6R: REAL ORTHANC PACS INTEGRATION FOUNDATION
// ==========================================

// GET /api/v1/technologist/pacs/status
router.get(
  ['/pacs/status', '/integrations/pacs/status'],
  asyncHandler(getPacsStatusHandler)
);

// GET /api/v1/technologist/worklist/:id/pacs-study
router.get(
  ['/worklist/:id/pacs-study', '/worklist/:id/pacs-study/lookup', '/orders/:id/pacs-study'],
  asyncHandler(lookupPacsStudyHandler)
);

// POST /api/v1/technologist/worklist/:id/pacs-study/reconcile
router.post(
  ['/worklist/:id/pacs-study/reconcile', '/orders/:id/pacs-study/reconcile'],
  asyncHandler(reconcilePacsStudyHandler)
);

// ==========================================
// REQUIREMENT 7: SUPPORTING DOCUMENTS
// ==========================================

// GET /api/v1/technologist/worklist/:id/documents
router.get(
  ['/worklist/:id/documents', '/orders/:id/documents'],
  asyncHandler(getOrderDocumentsHandler)
);

// POST /api/v1/technologist/worklist/:id/documents
router.post(
  ['/worklist/:id/documents', '/orders/:id/documents'],
  validateRequest({ body: uploadOrderDocumentSchema }),
  asyncHandler(uploadOrderDocumentHandler)
);

// GET /api/v1/technologist/worklist/:id/documents/:docId/download
router.get(
  [
    '/worklist/:id/documents/:docId/download',
    '/worklist/:id/documents/:docId/view',
    '/worklist/:id/documents/:docId',
    '/orders/:id/documents/:docId/download',
    '/orders/:id/documents/:docId',
  ],
  asyncHandler(downloadOrderDocumentHandler)
);

// DELETE /api/v1/technologist/worklist/:id/documents/:docId
router.delete(
  ['/worklist/:id/documents/:docId', '/orders/:id/documents/:docId'],
  asyncHandler(deleteOrderDocumentHandler)
);

export default router;

