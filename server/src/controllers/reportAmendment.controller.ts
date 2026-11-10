import { Request, Response } from 'express';
import {
  getReportVersionHistory,
  createReportAmendment,
  CreateReportAmendmentInput,
} from '../services/reportAmendment.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export async function getReportVersionHistoryHandler(
  req: Request,
  res: Response
): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Order identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const history = await getReportVersionHistory(id.trim(), userContext);
  return sendSuccess(res, history, 'Report version history retrieved successfully');
}

export async function createReportAmendmentHandler(
  req: Request,
  res: Response
): Promise<Response> {
  const { id } = req.params;
  if (!id || id.trim().length === 0) {
    throw AppError.badRequest('Order identifier is required');
  }

  const userContext = {
    userId: req.user!.id,
    role: req.user!.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  };

  const input: CreateReportAmendmentInput = {
    amendmentType: req.body.amendmentType,
    reason: req.body.reason,
    content: req.body.content,
    findings: req.body.findings,
    impression: req.body.impression,
    targetVersion: Number(req.body.targetVersion),
  };

  const result = await createReportAmendment(id.trim(), input, userContext);
  return sendSuccess(res, result, 'Report amendment created successfully', 201);
}

