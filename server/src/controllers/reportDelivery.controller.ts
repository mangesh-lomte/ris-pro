import { Request, Response } from 'express';
import {
  sendReportToReception,
  getReceptionReadyReports,
  recordDeliveryAcknowledgment,
  sendPatientNotification,
  recordReportReprint,
  getReportDeliveryHistory,
  getTatDashboardMetrics,
  loginPatient,
  getPatientReports,
  getPatientReportPdf,
  loginReferringDoctor,
  getReferringDoctorReports,
  getReferringDoctorReportPdf,
} from '../services/reportDelivery.service';
import { getReportPdfStream } from '../services/reportPdf.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { ReportDeliveryMethod, NotificationChannel, UserRole } from '@prisma/client';

export async function sendReportToReceptionHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const userContext = {
    userId: req.user?.id,
    role: req.user?.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await sendReportToReception(id, userContext);
  return sendSuccess(res, result, 'Finalized report successfully marked ready for reception delivery');
}

export async function getReceptionReadyReportsHandler(_req: Request, res: Response): Promise<Response> {
  const result = await getReceptionReadyReports();
  return sendSuccess(res, result, 'Reception ready reports retrieved successfully');
}

export async function recordDeliveryAcknowledgmentHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const deliveryMethod = req.body.deliveryMethod || ReportDeliveryMethod.RECEPTION_HANDOVER;
  const { recipientName, recipientRole, notes } = req.body;

  if (!recipientName) {
    throw AppError.badRequest('recipientName is required to acknowledge delivery');
  }

  const validMethods = Object.values(ReportDeliveryMethod);
  if (!validMethods.includes(deliveryMethod)) {
    throw AppError.badRequest(`Invalid deliveryMethod. Allowed: [${validMethods.join(', ')}]`);
  }

  const userContext = {
    userId: req.user?.id,
    role: req.user?.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await recordDeliveryAcknowledgment(
    id,
    {
      deliveryMethod,
      recipientName,
      recipientRole,
      notes,
    },
    userContext
  );

  return sendSuccess(res, result, 'Report delivery acknowledgment recorded successfully', 201);
}

export async function sendPatientNotificationHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const { channel, destinationOverride } = req.body;

  if (!channel) {
    throw AppError.badRequest('channel (SMS or EMAIL) is required for notification');
  }

  const validChannels = Object.values(NotificationChannel);
  if (!validChannels.includes(channel)) {
    throw AppError.badRequest(`Invalid channel. Allowed: [${validChannels.join(', ')}]`);
  }

  const userContext = {
    userId: req.user?.id,
    role: req.user?.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await sendPatientNotification(
    id,
    {
      channel,
      destinationOverride,
    },
    userContext
  );

  return sendSuccess(res, result, 'Patient notification sent successfully via local adapter', 201);
}

export async function recordReportReprintHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const { reason, copiesCount } = req.body;

  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const userContext = {
    userId: req.user.id,
    role: req.user.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const result = await recordReportReprint(
    id,
    {
      reason,
      copiesCount: copiesCount ? parseInt(copiesCount, 10) : 1,
    },
    userContext
  );

  return sendSuccess(res, result, 'Report reprint event recorded successfully', 201);
}

export async function printReportPdfHandler(req: Request, res: Response): Promise<void> {
  const { id } = req.params;

  if (!req.user) {
    throw AppError.unauthorized('Authentication required');
  }

  const userContext = {
    userId: req.user.id,
    role: req.user.role,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  // Record reprint log
  await recordReportReprint(
    id,
    {
      reason: req.query.reason ? String(req.query.reason) : 'Physical printout request',
      copiesCount: 1,
    },
    userContext
  );

  // Stream PDF
  const { buffer, filename, fileSizeBytes, contentType } = await getReportPdfStream(id, {
    userId: req.user.id,
    role: req.user.role as UserRole,
    ipAddress: userContext.ipAddress,
    userAgent: userContext.userAgent,
  });

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', fileSizeBytes);
  res.status(200).send(buffer);
}

export async function getReportDeliveryHistoryHandler(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  const result = await getReportDeliveryHistory(id);
  return sendSuccess(res, result, 'Report delivery history retrieved successfully');
}

export async function getTatDashboardMetricsHandler(_req: Request, res: Response): Promise<Response> {
  const result = await getTatDashboardMetrics();
  return sendSuccess(res, result, 'Turnaround Time (TAT) metrics retrieved successfully');
}

// ----------------- PORTAL CONTROLLERS -----------------

export async function patientLoginHandler(req: Request, res: Response): Promise<Response> {
  const { patientId, dateOfBirth } = req.body;
  if (!patientId || !dateOfBirth) {
    throw AppError.badRequest('patientId and dateOfBirth are required for patient portal login');
  }

  const result = await loginPatient({ patientId, dateOfBirth });
  return sendSuccess(res, result, 'Patient authenticated successfully');
}

export async function getPatientReportsHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const result = await getPatientReports(req.patient.patientId);
  return sendSuccess(res, result, 'Patient reports retrieved successfully');
}

export async function getPatientReportPdfHandler(req: Request, res: Response): Promise<void> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { accessionNumber } = req.params;
  if (!accessionNumber) {
    throw AppError.badRequest('accessionNumber parameter is required');
  }

  const userContext = {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const { buffer, filename, fileSizeBytes, contentType } = await getPatientReportPdf(
    req.patient.patientId,
    accessionNumber,
    userContext
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', fileSizeBytes);
  res.status(200).send(buffer);
}

export async function referringDoctorLoginHandler(req: Request, res: Response): Promise<Response> {
  const { email, registrationNumber } = req.body;
  if (!email) {
    throw AppError.badRequest('email is required for referring doctor portal login');
  }

  const result = await loginReferringDoctor({ email, registrationNumber });
  return sendSuccess(res, result, 'Referring physician authenticated successfully');
}

export async function getReferringDoctorReportsHandler(req: Request, res: Response): Promise<Response> {
  if (!req.referringDoctor) {
    throw AppError.unauthorized('Referring doctor authentication required');
  }

  const result = await getReferringDoctorReports(req.referringDoctor.id);
  return sendSuccess(res, result, 'Referred patient reports retrieved successfully');
}

export async function getReferringDoctorReportPdfHandler(req: Request, res: Response): Promise<void> {
  if (!req.referringDoctor) {
    throw AppError.unauthorized('Referring doctor authentication required');
  }

  const { accessionNumber } = req.params;
  if (!accessionNumber) {
    throw AppError.badRequest('accessionNumber parameter is required');
  }

  const userContext = {
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  };

  const { buffer, filename, fileSizeBytes, contentType } = await getReferringDoctorReportPdf(
    req.referringDoctor.id,
    accessionNumber,
    userContext
  );

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.setHeader('Content-Length', fileSizeBytes);
  res.status(200).send(buffer);
}
