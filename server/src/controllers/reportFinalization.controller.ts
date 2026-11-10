import { Request, Response } from 'express';
import { z } from 'zod';
import { sendSuccess } from '../utils/apiResponse';
import {
  getReportReviewSummary,
  finalizeAndSignReport,
} from '../services/reportFinalization.service';

export const finalizeReportSchema = z.object({
  draftVersion: z.number().int().positive().optional(),
  findings: z.string().min(1, 'Findings are required'),
  impression: z.string().min(1, 'Impression is required'),
  approved: z.literal(true, {
    errorMap: () => ({ message: 'Report review approval is required' }),
  }),
  signatureStatement: z.string().optional(),
});

export async function getReportReviewSummaryHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = req.user!;

  const summary = await getReportReviewSummary(id, {
    userId: user.id,
    role: user.role,
  });

  return sendSuccess(res, summary, 'Report review summary retrieved');
}

export async function finalizeAndSignReportHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = req.user!;
  const payload = req.body;

  const result = await finalizeAndSignReport(id, payload, {
    userId: user.id,
    role: user.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  return sendSuccess(res, result, 'Report successfully authorized, signed, locked, and finalized', 201);
}

