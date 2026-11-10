import { Request, Response } from 'express';
import { generateReportPdf, getReportPdfStream } from '../services/reportPdf.service';
import { sendSuccess } from '../utils/apiResponse';

/**
 * Generates an authoritative clinical PDF for a finalized and locked diagnostic report.
 * POST /api/v1/radiologist/worklist/:id/report/pdf
 */
export async function generateReportPdfHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = req.user!;

  const result = await generateReportPdf(id, {
    userId: user.id,
    role: user.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  return sendSuccess(res, result, 'Diagnostic report PDF successfully generated and persisted', 201);
}

/**
 * Downloads or views the authoritative clinical PDF for a finalized report.
 * GET /api/v1/radiologist/worklist/:id/report/pdf
 */
export async function getReportPdfHandler(req: Request, res: Response) {
  const { id } = req.params;
  const user = req.user!;

  const { buffer, filename, fileSizeBytes, contentType } = await getReportPdfStream(id, {
    userId: user.id,
    role: user.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'] as string | undefined,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', fileSizeBytes);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');

  return res.send(buffer);
}

