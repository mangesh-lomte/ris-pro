import { Router } from 'express';
import { UserRole } from '@prisma/client';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { getPacsStatusHandler } from '../controllers/technologist.controller';
import {
  getMwl,
  getConfigs,
  saveConfig,
  receiveCStore,
  mppsUpdate,
  storageCommitment,
  matchStudy,
  getFailedTransfers,
  retryTransfer,
  getScannerMonitor,
  captureDose,
  getDoseSummary,
  reconcileUnscheduled,
  dicomWebStudies,
  dicomWebInstances,
  handleHl7Message,
  getFhirImagingStudy,
} from '../controllers/modalityIntegration.controller';

const router = Router();

// All integration endpoints require authentication
router.use(authenticate);

// Legacy PACS Status endpoint
router.get(
  ['/pacs/status', '/pacs'],
  requireRole(UserRole.TECHNOLOGIST, UserRole.ADMIN),
  asyncHandler(getPacsStatusHandler)
);

// 1. Modality Worklist (MWL)
router.get(
  '/mwl',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(getMwl)
);

// 2. AE Title / IP / Port config
router.get(
  '/modalities',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(getConfigs)
);
router.post(
  '/modalities/config',
  requireRole(UserRole.ADMIN),
  asyncHandler(saveConfig)
);

// 3. C-STORE image receive
router.post(
  '/c-store',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(receiveCStore)
);

// 4. MPPS procedure step update
router.post(
  '/mpps',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(mppsUpdate)
);

// 5. Storage Commitment
router.post(
  '/storage-commitment',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(storageCommitment)
);

// 6. Study / accession matching
router.post(
  '/reconcile-study',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(matchStudy)
);

// 7. Failed-transfer retry queue
router.get(
  '/transfers/failed',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(getFailedTransfers)
);
router.post(
  '/transfers/:id/retry',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(retryTransfer)
);

// 8. Scanner status monitor
router.get(
  '/scanner-status',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getScannerMonitor)
);

// 9. Radiation dose capture (RDSR)
router.post(
  '/dose-capture',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST),
  asyncHandler(captureDose)
);
router.get(
  '/orders/:accession/dose',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getDoseSummary)
);

// 10. Unscheduled / emergency scan match
router.post(
  '/unscheduled-reconcile',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(reconcileUnscheduled)
);

// 11. DICOMweb query (QIDO-RS / WADO-RS)
router.get(
  '/dicomweb/studies',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(dicomWebStudies)
);
router.get(
  '/dicomweb/studies/:studyUid/instances',
  requireRole(UserRole.ADMIN, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(dicomWebInstances)
);

// 12. HL7 / FHIR order adapter
router.post(
  '/hl7',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST),
  asyncHandler(handleHl7Message)
);
router.get(
  '/fhir/ImagingStudy/:accession',
  requireRole(UserRole.ADMIN, UserRole.RECEPTION, UserRole.TECHNOLOGIST, UserRole.RADIOLOGIST),
  asyncHandler(getFhirImagingStudy)
);

export default router;
