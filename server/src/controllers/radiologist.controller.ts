import { Request, Response } from 'express';
import { z } from 'zod';
import { ModalityType, Priority } from '@prisma/client';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import {
  getRadiologistWorklist,
  getRadiologistStudyContext,
  claimStudy,
  assignStudy,
  releaseStudy,
  listActiveRadiologists,
  getViewerLaunchContext,
  getPriorStudiesForOrder,
  getPriorReportDetail,
  getReportWorkspaceContext,
  createReportDraft,
  saveReportDraft,
  autosaveReportDraft,
  recordDictationEvent,
  getStudyInstances,
} from '../services/radiologist.service';

export const radiologistWorklistQuerySchema = z.object({
  modality: z.nativeEnum(ModalityType).optional(),
  priority: z.nativeEnum(Priority).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be formatted as YYYY-MM-DD').optional(),
  assignmentStatus: z.enum(['UNASSIGNED', 'ASSIGNED', 'ALL']).optional(),
  assignedTo: z.string().trim().optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const assignRadiologistSchema = z.object({
  radiologistUserId: z
    .string({ required_error: 'Target radiologist user ID is required' })
    .trim()
    .min(1, 'Target radiologist user ID is required'),
});

/**
 * GET /api/v1/radiologist/worklist
 */
export async function getWorklistHandler(req: Request, res: Response): Promise<Response> {
  const query = req.query as z.infer<typeof radiologistWorklistQuerySchema>;
  const currentUserId = req.user!.id;
  const userRole = req.user!.role;

  const result = await getRadiologistWorklist(query, currentUserId, userRole);
  return sendSuccess(res, result, 'Radiologist worklist retrieved successfully');
}

/**
 * GET /api/v1/radiologist/worklist/:id
 */
export async function getStudyContextHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const currentUserId = req.user!.id;
  const result = await getRadiologistStudyContext(id.trim(), currentUserId);
  return sendSuccess(res, result, 'Radiologist study context retrieved successfully');
}

/**
 * POST /api/v1/radiologist/worklist/:id/claim
 */
export async function claimStudyHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await claimStudy(id.trim(), userContext);
  return sendSuccess(res, result, 'Study claimed successfully by radiologist', 200);
}

/**
 * POST /api/v1/radiologist/worklist/:id/assign
 */
export async function assignStudyHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const { radiologistUserId } = req.body as z.infer<typeof assignRadiologistSchema>;
  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await assignStudy(id.trim(), radiologistUserId, userContext);
  return sendSuccess(res, result, 'Study assigned to radiologist successfully', 200);
}

/**
 * POST /api/v1/radiologist/worklist/:id/release
 */
export async function releaseStudyHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await releaseStudy(id.trim(), userContext, req.user!.role);
  return sendSuccess(res, result, 'Study assignment released successfully', 200);
}

/**
 * GET /api/v1/radiologist/radiologists
 */
export async function listRadiologistsHandler(_req: Request, res: Response): Promise<Response> {
  const result = await listActiveRadiologists();
  return sendSuccess(res, result, 'Active radiologists retrieved successfully');
}

/**
 * GET /api/v1/radiologist/worklist/:id/viewer-launch
 * Supports optional ?priorId= query param for multi-study comparison.
 */
export async function getViewerLaunchHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const priorId = req.query.priorId ? String(req.query.priorId).trim() : undefined;

  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await getViewerLaunchContext(id.trim(), userContext, priorId);
  return sendSuccess(res, result, 'Viewer launch configuration generated successfully');
}

/**
 * GET /api/v1/radiologist/worklist/:id/priors
 */
export async function getPriorStudiesHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const result = await getPriorStudiesForOrder(id.trim());
  return sendSuccess(res, result, 'Prior studies retrieved successfully');
}

/**
 * GET /api/v1/radiologist/worklist/:id/priors/:priorId/report
 */
export async function getPriorReportHandler(req: Request, res: Response): Promise<Response> {
  const { id, priorId } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Current study identifier is required');
  }
  if (!priorId || priorId.trim().length === 0) {
    throw AppError.badRequest('Prior study identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await getPriorReportDetail(id.trim(), priorId.trim(), userContext);
  return sendSuccess(res, result, 'Prior report retrieved successfully');
}

export const createReportDraftSchema = z.object({
  templateId: z.string().trim().optional(),
  content: z.record(z.string()).optional(),
});

export const measurementReferenceSchema = z.object({
  id: z.string().trim().min(1),
  toolType: z.enum([
    'Length',
    'Bidirectional',
    'EllipticalROI',
    'CircleROI',
    'RectangleROI',
    'Angle',
    'CobbAngle',
    'ArrowAnnotate',
    'Probe',
    'PlanarFreehandROI',
  ]),
  label: z.string().trim().min(1).max(100),
  numericValue: z.number(),
  unit: z.string().trim().min(1).max(20),
  studyInstanceUid: z.string().trim().min(1),
  seriesInstanceUid: z.string().trim().min(1),
  sopInstanceUid: z.string().trim().min(1),
  frameNumber: z.number().int().min(1).optional(),
  instanceNumber: z.number().int().optional(),
  sliceLocation: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).optional(),
  findingText: z.string().trim().max(500).optional(),
  createdAt: z.string().optional(),
});

export const keyImageReferenceSchema = z.object({
  id: z.string().trim().min(1),
  studyInstanceUid: z.string().trim().min(1),
  seriesInstanceUid: z.string().trim().min(1),
  sopInstanceUid: z.string().trim().min(1),
  frameNumber: z.number().int().min(1).optional(),
  instanceNumber: z.number().int().optional(),
  sliceLocation: z.union([z.number(), z.string().transform((v) => parseFloat(v))]).optional(),
  label: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional(),
  createdAt: z.string().optional(),
});

export const updateReportDraftSchema = z.object({
  version: z.number().int().min(1, 'Draft version is required for concurrency control'),
  content: z.record(z.string()),
  measurements: z.array(measurementReferenceSchema).optional(),
  keyImages: z.array(keyImageReferenceSchema).optional(),
});

/**
 * GET /api/v1/radiologist/worklist/:id/report
 */
export async function getReportWorkspaceHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await getReportWorkspaceContext(id.trim(), userContext);
  return sendSuccess(res, result, 'Report workspace context retrieved successfully');
}

/**
 * POST /api/v1/radiologist/worklist/:id/report/draft
 */
export async function createReportDraftHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const parsed = createReportDraftSchema.parse(req.body || {});
  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await createReportDraft(id.trim(), parsed, userContext);
  return sendSuccess(res, result, 'Report draft created successfully', 201);
}

/**
 * PATCH or PUT /api/v1/radiologist/worklist/:id/report/draft
 */
export async function saveReportDraftHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const parsed = updateReportDraftSchema.parse(req.body);
  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await saveReportDraft(id.trim(), parsed, userContext);
  return sendSuccess(res, result, 'Report draft saved successfully', 200);
}

/**
 * POST /api/v1/radiologist/worklist/:id/report/draft/autosave
 */
export async function autosaveReportDraftHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const parsed = updateReportDraftSchema.parse(req.body);
  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await autosaveReportDraft(id.trim(), parsed, userContext);
  return sendSuccess(res, result, 'Report draft autosaved successfully', 200);
}

export const recordDictationEventSchema = z.object({
  action: z.enum(['START', 'COMPLETE']),
  section: z.string().trim().max(100).optional(),
});

/**
 * POST /api/v1/radiologist/worklist/:id/report/dictation/session
 */
export async function recordDictationEventHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const parsed = recordDictationEventSchema.parse(req.body);
  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await recordDictationEvent(id.trim(), parsed, userContext);
  return sendSuccess(res, result, 'Dictation session event recorded successfully', 200);
}

/**
 * GET /api/v1/radiologist/worklist/:id/study-instances
 */
export async function getStudyInstancesHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Study identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
  };

  const result = await getStudyInstances(id.trim(), userContext);
  return sendSuccess(res, result, 'Study instances retrieved successfully', 200);
}



