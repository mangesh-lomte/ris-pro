import { Request, Response } from 'express';
import { z } from 'zod';
import { CriticalFindingStatus } from '@prisma/client';
import { sendSuccess } from '../utils/apiResponse';
import {
  createCriticalFinding,
  getCriticalFindingQueue,
  getCriticalFindingById,
  getOrderCriticalFinding,
  acknowledgeCriticalFinding,
  getActiveClinicians,
} from '../services/criticalFinding.service';

export const createCriticalFindingSchema = z.object({
  imagingOrderId: z.string().min(1, 'Imaging order ID is required'),
  recipientId: z.string().min(1, 'Responsible clinician recipient ID is required'),
  findingText: z.string().min(1, 'Finding text is required').max(5000, 'Finding text must not exceed 5000 characters'),
  severity: z.string().max(50).optional(),
});

export const acknowledgeCriticalFindingSchema = z.object({
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/v1/radiologist/critical-findings
 */
export async function createCriticalFindingHandler(req: Request, res: Response): Promise<Response> {
  const { imagingOrderId, recipientId, findingText, severity } = req.body;

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await createCriticalFinding({
    imagingOrderId,
    recipientId,
    findingText,
    severity,
    userContext,
    requesterRole: req.user!.role,
  });

  return sendSuccess(res, result, 'Critical finding alert created and sent successfully', 201);
}

/**
 * GET /api/v1/radiologist/critical-findings
 */
export async function getCriticalFindingQueueHandler(req: Request, res: Response): Promise<Response> {
  const query = req.query as any;

  const result = await getCriticalFindingQueue({
    status: query.status as CriticalFindingStatus | undefined,
    page: query.page ? parseInt(query.page as string, 10) : 1,
    limit: query.limit ? parseInt(query.limit as string, 10) : 20,
    userId: req.user!.id,
    userRole: req.user!.role,
  });

  return sendSuccess(res, result, 'Critical finding alerts retrieved successfully', 200);
}

/**
 * GET /api/v1/radiologist/critical-findings/:id
 */
export async function getCriticalFindingByIdHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const result = await getCriticalFindingById(id);
  return sendSuccess(res, result, 'Critical finding details retrieved successfully', 200);
}

/**
 * GET /api/v1/radiologist/worklist/:orderId/critical-finding
 */
export async function getOrderCriticalFindingHandler(req: Request, res: Response): Promise<Response> {
  const { orderId } = req.params;
  const result = await getOrderCriticalFinding(orderId);
  return sendSuccess(res, result, 'Order critical finding retrieved successfully', 200);
}

/**
 * POST /api/v1/radiologist/critical-findings/:id/acknowledge
 */
export async function acknowledgeCriticalFindingHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const { notes } = req.body;

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await acknowledgeCriticalFinding({
    id,
    notes,
    userContext,
    userRole: req.user!.role,
  });

  return sendSuccess(res, result, 'Critical finding acknowledged successfully', 200);
}

/**
 * GET /api/v1/radiologist/clinicians
 */
export async function getActiveCliniciansHandler(_req: Request, res: Response): Promise<Response> {
  const result = await getActiveClinicians();
  return sendSuccess(res, result, 'Active clinicians retrieved successfully', 200);
}

