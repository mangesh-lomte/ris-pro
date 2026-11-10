import { Request, Response } from 'express';
import { z } from 'zod';
import { PeerReviewStatus } from '@prisma/client';
import { AppError } from '../utils/appError';
import { sendSuccess } from '../utils/apiResponse';
import {
  requestPeerReview,
  getPeerReviewQueue,
  getPeerReviewContext,
  claimPeerReview,
  submitPeerReview,
  cancelPeerReview,
  getPeerReviewForOrder,
} from '../services/peerReview.service';

export const requestPeerReviewSchema = z.object({
  imagingOrderId: z.string().min(1, 'Imaging order identifier is required'),
  reviewerId: z.string().min(1, 'Reviewer identifier is required'),
  reason: z.string().max(1000, 'Reason must not exceed 1000 characters').optional(),
});

export const peerReviewQueueQuerySchema = z.object({
  status: z.nativeEnum(PeerReviewStatus).optional(),
  type: z.enum(['assigned', 'requested', 'all']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const submitPeerReviewSchema = z.object({
  reviewComment: z.string().min(1, 'Review comment is required').max(5000, 'Comment must not exceed 5000 characters'),
  decision: z.string().max(100, 'Decision must not exceed 100 characters').optional(),
});

/**
 * POST /api/v1/radiologist/peer-reviews
 */
export async function requestPeerReviewHandler(req: Request, res: Response): Promise<Response> {
  const { imagingOrderId, reviewerId, reason } = req.body;

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await requestPeerReview({
    imagingOrderId,
    reviewerId,
    reason,
    userContext,
    requesterRole: req.user!.role,
  });

  return sendSuccess(res, result, 'Peer review request submitted successfully', 201);
}

/**
 * GET /api/v1/radiologist/peer-reviews
 */
export async function getPeerReviewQueueHandler(req: Request, res: Response): Promise<Response> {
  const query = req.query as any;

  const result = await getPeerReviewQueue(req.user!.id, req.user!.role, {
    status: query.status,
    type: query.type,
    page: query.page,
    limit: query.limit,
  });

  return sendSuccess(res, result, 'Peer review queue retrieved successfully', 200);
}

/**
 * GET /api/v1/radiologist/peer-reviews/:id
 */
export async function getPeerReviewContextHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Peer review identifier is required');
  }

  const result = await getPeerReviewContext(id.trim(), req.user!.id, req.user!.role);
  return sendSuccess(res, result, 'Peer review details retrieved successfully', 200);
}

/**
 * POST /api/v1/radiologist/peer-reviews/:id/claim
 */
export async function claimPeerReviewHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Peer review identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await claimPeerReview(id.trim(), userContext, req.user!.role);
  return sendSuccess(res, result, 'Peer review claimed successfully', 200);
}

/**
 * POST /api/v1/radiologist/peer-reviews/:id/submit
 */
export async function submitPeerReviewHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Peer review identifier is required');
  }

  const { reviewComment, decision } = req.body;

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await submitPeerReview({
    peerReviewId: id.trim(),
    reviewComment,
    decision,
    userContext,
    role: req.user!.role,
  });

  return sendSuccess(res, result, 'Second opinion submitted successfully', 200);
}

/**
 * POST /api/v1/radiologist/peer-reviews/:id/cancel
 */
export async function cancelPeerReviewHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Peer review identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const result = await cancelPeerReview(id.trim(), userContext, req.user!.role);
  return sendSuccess(res, result, 'Peer review cancelled successfully', 200);
}

/**
 * GET /api/v1/radiologist/worklist/:id/peer-review
 */
export async function getOrderPeerReviewHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Order identifier is required');
  }

  const result = await getPeerReviewForOrder(id.trim(), req.user!.id, req.user!.role);
  return sendSuccess(res, result, 'Order peer review retrieved successfully', 200);
}

