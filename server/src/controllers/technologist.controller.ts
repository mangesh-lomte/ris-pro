import { Request, Response } from 'express';
import { z } from 'zod';
import {
  getTechnologistWorklist,
  getTechnologistWorklistItem,
} from '../services/technologist.service';
import {
  getSafetyScreeningContext,
  saveSafetyScreening,
} from '../services/safetyScreening.service';
import {
  getPreparationContext,
  savePreparation,
} from '../services/preparation.service';
import { confirmProtocol } from '../services/protocol.service';
import {
  uploadOrderDocument,
  getOrderDocuments,
  getOrderDocumentFile,
  deleteOrderDocument,
} from '../services/orderDocument.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export const technologistWorklistQuerySchema = z.object({
  page: z.coerce.number().int().min(1, 'Page must be an integer >= 1').default(1),
  pageSize: z.coerce.number().int().min(1).max(100, 'PageSize cannot exceed 100').default(20),
  modality: z
    .enum(['ALL', 'CT', 'MRI', 'XRAY', 'ULTRASOUND', 'MAMMOGRAPHY', 'PET_CT'], {
      errorMap: () => ({ message: 'Invalid modality. Supported: ALL, CT, MRI, XRAY, ULTRASOUND, MAMMOGRAPHY, PET_CT' }),
    })
    .optional(),
  priority: z
    .enum(['ALL', 'STAT', 'URGENT', 'ROUTINE'], {
      errorMap: () => ({ message: 'Invalid priority. Supported: ALL, STAT, URGENT, ROUTINE' }),
    })
    .optional(),
  date: z
    .string()
    .refine((val) => val === 'ALL' || !isNaN(Date.parse(val)) || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Date must be YYYY-MM-DD, a valid ISO date, or ALL',
    })
    .optional(),
  equipmentId: z.string().trim().max(100).optional(),
  search: z.string().trim().max(100, 'Search query cannot exceed 100 characters').optional(),
});

const answerOptionSchema = z.enum(['YES', 'NO', 'UNKNOWN', 'NOT_APPLICABLE']).optional();

export const saveSafetyScreeningSchema = z.object({
  identityVerified: z.boolean({
    required_error: 'Patient identity verification status is required',
  }),
  identityVerificationMethod: z
    .string({
      required_error: 'Identity verification method is required',
    })
    .trim()
    .min(3, 'Identity verification method must specify at least 3 characters (e.g. WRISTBAND_AND_VERBAL)'),
  safetyNotes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  answers: z
    .object({
      mri_pacemaker: answerOptionSchema,
      mri_aneurysm_clip: answerOptionSchema,
      mri_cochlear_implant: answerOptionSchema,
      mri_neurostimulator: answerOptionSchema,
      mri_infusion_pump: answerOptionSchema,
      mri_metal_in_eyes: answerOptionSchema,
      mri_implants_other: answerOptionSchema,
      mri_pregnancy: answerOptionSchema,
      mri_claustrophobia: answerOptionSchema,
      mri_contrast_allergy: answerOptionSchema,
      mri_renal_disease: answerOptionSchema,

      ct_pregnancy: answerOptionSchema,
      ct_contrast_allergy: answerOptionSchema,
      ct_renal_disease: answerOptionSchema,
      ct_metformin: answerOptionSchema,
      ct_asthma_allergies: answerOptionSchema,

      xray_pregnancy: answerOptionSchema,
    })
    .passthrough(),
});

export async function getWorklist(req: Request, res: Response): Promise<Response> {
  const query = req.query as unknown as z.infer<typeof technologistWorklistQuerySchema>;
  const result = await getTechnologistWorklist(query);
  return sendSuccess(res, result, 'Technologist worklist retrieved successfully');
}

export async function getWorklistItem(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getTechnologistWorklistItem(id.trim());
  return sendSuccess(res, result, 'Technologist exam details retrieved successfully');
}

export async function getSafetyScreening(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getSafetyScreeningContext(id.trim());
  return sendSuccess(res, result, 'Safety screening context retrieved successfully');
}

export async function saveSafetyScreeningHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await saveSafetyScreening(id.trim(), payload, userContext);
  return sendSuccess(
    res,
    result,
    result.decision.safetyStatus === 'CLEARED'
      ? 'Patient safety screening completed and exam cleared for technologist preparation'
      : 'Patient safety screening saved and marked for clinical review',
    201
  );
}

export const savePreparationSchema = z.object({
  fastingStatus: z.enum(['NOT_REQUIRED', 'CONFIRMED', 'NOT_CONFIRMED', 'UNKNOWN']).optional(),
  ivReady: z.boolean().optional(),
  contrastReady: z.boolean().optional(),
  consentStatus: z.enum(['NOT_REQUIRED', 'CONFIRMED', 'NOT_CONFIRMED']).optional(),
  additionalPreparationComplete: z.boolean().optional(),
  preparationNotes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

export const confirmProtocolSchema = z.object({
  protocolId: z.string({
    required_error: 'protocolId is required for confirmation',
  }).trim().min(1, 'protocolId cannot be empty'),
});

export const uploadOrderDocumentSchema = z.object({
  category: z.enum(['REFERRAL', 'LAB_RESULT', 'CONSENT', 'PREVIOUS_REPORT', 'OTHER'], {
    errorMap: () => ({ message: 'Category must be one of: REFERRAL, LAB_RESULT, CONSENT, PREVIOUS_REPORT, OTHER' }),
  }),
  fileName: z.string().trim().min(1, 'File name is required').max(255),
  fileType: z.string().trim().min(1, 'File type is required').max(100),
  fileBase64: z.string().min(1, 'File content is required'),
  notes: z.string().trim().max(1000).optional(),
});

export async function getPreparationHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getPreparationContext(id.trim());
  return sendSuccess(res, result, 'Technologist preparation context retrieved successfully');
}

export async function savePreparationHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await savePreparation(id.trim(), payload, userContext);
  return sendSuccess(
    res,
    result,
    result.preparationStatus === 'COMPLETE'
      ? 'Patient preparation completed successfully. Ready for protocol confirmation.'
      : 'Patient preparation updated and currently in progress.',
    200
  );
}

export async function confirmProtocolHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const { protocolId } = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await confirmProtocol(id.trim(), protocolId, userContext);
  return sendSuccess(
    res,
    result,
    'Protocol confirmed successfully. Order is now READY FOR SCAN.',
    200
  );
}

import {
  cancelScan,
  CANCELLATION_REASONS,
  finishScan,
  getScanLifecycleContext,
  INTERRUPTION_REASONS,
  interruptScan,
  resumeScan,
  startScan,
} from '../services/scanLifecycle.service';

export const startScanSchema = z.object({
  equipmentId: z.string().trim().optional(),
});

export const interruptScanSchema = z
  .object({
    reason: z.enum(INTERRUPTION_REASONS, {
      required_error: 'Interruption reason is required',
    }),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  })
  .refine((data) => data.reason !== 'OTHER' || (data.notes && data.notes.length >= 3), {
    message: "Notes are required when interruption reason is 'OTHER' (at least 3 characters)",
    path: ['notes'],
  });

export const cancelScanSchema = z
  .object({
    reason: z.enum(CANCELLATION_REASONS, {
      required_error: 'Cancellation reason is required',
    }),
    notes: z.string().trim().max(1000, 'Notes cannot exceed 1000 characters').optional(),
  })
  .refine((data) => data.reason !== 'OTHER' || (data.notes && data.notes.length >= 3), {
    message: "Notes are required when cancellation reason is 'OTHER' (at least 3 characters)",
    path: ['notes'],
  });

export async function getScanHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getScanLifecycleContext(id.trim());
  return sendSuccess(res, result, 'Scan lifecycle context retrieved successfully');
}

export async function startScanHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const { equipmentId } = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await startScan(id.trim(), equipmentId, userContext);
  return sendSuccess(
    res,
    result,
    'Scan acquisition started successfully. Order status updated to SCAN_IN_PROGRESS.',
    201
  );
}

export async function interruptScanHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await interruptScan(id.trim(), payload, userContext);
  return sendSuccess(
    res,
    result,
    'Scan acquisition interrupted. Order status updated to SCAN_INTERRUPTED.',
    200
  );
}

export async function resumeScanHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await resumeScan(id.trim(), userContext);
  return sendSuccess(
    res,
    result,
    'Scan acquisition resumed successfully. Order status returned to SCAN_IN_PROGRESS.',
    200
  );
}

export async function finishScanHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await finishScan(id.trim(), userContext);
  return sendSuccess(
    res,
    result,
    'Scan acquisition finished successfully. Order status updated to SCAN_COMPLETED.',
    200
  );
}

export async function cancelScanHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await cancelScan(id.trim(), payload, userContext);
  return sendSuccess(
    res,
    result,
    'Scan acquisition cancelled. Order status updated to SCAN_CANCELLED.',
    200
  );
}

import {
  CONTRAST_ROUTES,
  INCIDENT_CATEGORIES,
  INCIDENT_WORKFLOW_ACTIONS,
  getContrastContext,
  recordContrastAdministration,
  getIncidents,
  recordIncident,
} from '../services/contrastIncident.service';

export const recordContrastSchema = z.object({
  contrastAgentName: z
    .string({ required_error: 'Contrast agent name is required' })
    .trim()
    .min(1, 'Contrast agent name cannot be empty')
    .max(200, 'Agent name cannot exceed 200 characters'),
  concentration: z.string().trim().max(100).optional(),
  volume: z
    .number({ required_error: 'Administered volume is required' })
    .positive('Administered volume must be a positive number')
    .max(1000, 'Administered volume exceeds reasonable system maximum'),
  volumeUnit: z.literal('mL').default('mL'),
  route: z.enum(CONTRAST_ROUTES, {
    required_error: 'Contrast administration route is required',
  }),
  routeNotes: z.string().trim().max(500).optional(),
  batchLotNumber: z.string().trim().max(100).optional(),
  expirationDate: z.string().trim().optional(),
  administrationNotes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

export const recordIncidentSchema = z.object({
  category: z.enum(INCIDENT_CATEGORIES, {
    required_error: 'Incident category is required',
  }),
  description: z
    .string({ required_error: 'Incident description is required' })
    .trim()
    .min(3, 'Description must be at least 3 characters')
    .max(2000, 'Description cannot exceed 2000 characters')
    .refine((val) => !/<[a-z][\s\S]*>/i.test(val), {
      message: 'Description must not contain HTML or scripts',
    }),
  contrastAdministrationId: z.string().trim().optional(),
  clinicianNotified: z.boolean().default(false),
  notificationNotes: z.string().trim().max(2000).optional(),
  workflowActionTaken: z.enum(INCIDENT_WORKFLOW_ACTIONS).optional(),
  workflowActionNotes: z.string().trim().max(500).optional(),
});

export async function getContrastHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getContrastContext(id.trim());
  return sendSuccess(res, result, 'Contrast administration context retrieved successfully');
}

export async function recordContrastHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await recordContrastAdministration(id.trim(), payload, userContext);
  return sendSuccess(res, result, 'Contrast administration recorded successfully', 201);
}

export async function getIncidentsHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getIncidents(id.trim());
  return sendSuccess(res, result, 'Examination incidents retrieved successfully');
}

export async function recordIncidentHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await recordIncident(id.trim(), payload, userContext);
  return sendSuccess(res, result, 'Technologist incident recorded successfully', 201);
}

import {
  getImageQualityContext,
  startImageQualityReview,
  acceptImageQuality,
  markRepeatRequired,
  rejectImageQuality,
  authorizeRepeat,
  getPacsHandoffContext,
  initiatePacsHandoff,
  retryPacsHandoff,
} from '../services/imageQuality.service';
import {
  getPacsStatus,
  lookupPacsStudy,
  reconcilePacsStudy,
} from '../services/pacsReconciliation.service';

export const QA_REASONS = [
  'PATIENT_MOTION',
  'POSITIONING',
  'COVERAGE_INCOMPLETE',
  'TECHNICAL_ARTIFACT',
  'PROTOCOL_DEVIATION',
  'OTHER',
] as const;

export const acceptImageQualitySchema = z.object({
  notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
});

export const repeatRequiredSchema = z
  .object({
    reason: z.enum(QA_REASONS, {
      required_error: 'Repeat reason is required',
    }),
    notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  })
  .refine((data) => data.reason !== 'OTHER' || (data.notes && data.notes.length >= 3), {
    message: "Notes are required when reason is 'OTHER' (at least 3 characters)",
    path: ['notes'],
  });

export const rejectImageQualitySchema = z
  .object({
    reason: z.enum(QA_REASONS, {
      required_error: 'Rejection reason is required',
    }),
    notes: z.string().trim().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  })
  .refine((data) => data.reason !== 'OTHER' || (data.notes && data.notes.length >= 3), {
    message: "Notes are required when reason is 'OTHER' (at least 3 characters)",
    path: ['notes'],
  });

export async function getImageQualityHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getImageQualityContext(id.trim());
  return sendSuccess(res, result, 'Image quality context retrieved successfully');
}

export async function startImageQualityHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await startImageQualityReview(id.trim(), userContext);
  return sendSuccess(res, result, 'Image Quality Review started successfully', 201);
}

export async function acceptImageQualityHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body || {};
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await acceptImageQuality(id.trim(), payload, userContext);
  return sendSuccess(res, result, 'Image Quality accepted. Examination is now PACS READY.', 200);
}

export async function repeatRequiredHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await markRepeatRequired(id.trim(), payload, userContext);
  return sendSuccess(res, result, 'Repeat required decision recorded. Awaiting repeat authorization.', 200);
}

export async function rejectImageQualityHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const payload = req.body;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await rejectImageQuality(id.trim(), payload, userContext);
  return sendSuccess(res, result, 'Image acquisition rejected. Downstream PACS transfer blocked.', 200);
}

export async function authorizeRepeatHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await authorizeRepeat(id.trim(), userContext);
  return sendSuccess(res, result, 'Repeat authorized successfully. Exam returned to READY FOR SCAN.', 200);
}

export async function getPacsHandoffHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const result = await getPacsHandoffContext(id.trim());
  return sendSuccess(res, result, 'PACS handoff context retrieved successfully');
}

export async function initiatePacsHandoffHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await initiatePacsHandoff(id.trim(), userContext);
  const message =
    result.pacsHandoff.status === 'COMPLETE'
      ? 'Simulated PACS handoff completed successfully'
      : 'Simulated PACS handoff failed';
  return sendSuccess(res, result, message, 200);
}

export async function retryPacsHandoffHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await retryPacsHandoff(id.trim(), userContext);
  const message =
    result.pacsHandoff.status === 'COMPLETE'
      ? 'Simulated PACS handoff retry succeeded'
      : 'Simulated PACS handoff retry failed';
  return sendSuccess(res, result, message, 200);
}

// ==========================================
// PHASE 3.6R: REAL ORTHANC PACS INTEGRATION
// ==========================================

export async function getPacsStatusHandler(_req: Request, res: Response): Promise<Response> {
  const result = await getPacsStatus();
  return sendSuccess(res, result, 'PACS integration status retrieved successfully', 200);
}

export async function lookupPacsStudyHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await lookupPacsStudy(id.trim(), userContext);
  return sendSuccess(res, result, result.message, 200);
}

export async function reconcilePacsStudyHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await reconcilePacsStudy(id.trim(), userContext);
  return sendSuccess(res, result, result.message, 200);
}

// ==========================================
// REQUIREMENT 7: SUPPORTING DOCUMENTS UPLOAD
// ==========================================

export async function uploadOrderDocumentHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const doc = await uploadOrderDocument(id.trim(), req.body, userContext);
  return sendSuccess(res, doc, 'Document attached successfully', 201);
}

export async function getOrderDocumentsHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Exam identifier is required');
  }

  const docs = await getOrderDocuments(id.trim());
  return sendSuccess(res, docs, 'Documents retrieved successfully', 200);
}

export async function downloadOrderDocumentHandler(req: Request, res: Response): Promise<void> {
  const { id, docId } = req.params;
  if (!id || !docId) {
    throw AppError.badRequest('Exam identifier and document ID are required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const { fileBuffer, fileName, fileType, fileSize } = await getOrderDocumentFile(id.trim(), docId.trim(), userContext);

  res.setHeader('Content-Type', fileType);
  res.setHeader('Content-Length', fileSize);
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(fileName)}"`);
  res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
  res.send(fileBuffer);
}

export async function deleteOrderDocumentHandler(req: Request, res: Response): Promise<Response> {
  const { id, docId } = req.params;
  if (!id || !docId) {
    throw AppError.badRequest('Exam identifier and document ID are required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await deleteOrderDocument(id.trim(), docId.trim(), userContext);
  return sendSuccess(res, result, 'Document deleted successfully', 200);
}







