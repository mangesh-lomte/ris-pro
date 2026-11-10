import { Request, Response } from 'express';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';
import { ModalityType } from '@prisma/client';
import {
  requestPatientOtp,
  verifyPatientOtp,
  getPortalExaminations,
  getPortalSlots,
  bookPortalAppointment,
  uploadPortalReferral,
  getPortalReferralFile,
  getPortalPreparationInstructions,
  submitPortalQuestionnaire,
  payPortalAdvanceDeposit,
  reschedulePortalAppointment,
  cancelPortalAppointment,
  sendPortalAppointmentReminder,
  getPatientPortalAppointments,
  getPatientReportViewer,
} from '../services/patientPortalBooking.service';

/**
 * POST /api/v1/portal/patient/request-otp
 */
export async function requestPatientOtpHandler(req: Request, res: Response): Promise<Response> {
  const { phone } = req.body;
  if (!phone) {
    throw AppError.badRequest('Mobile phone number is required');
  }

  const result = await requestPatientOtp(phone);
  return sendSuccess(res, result, 'OTP sent successfully');
}

/**
 * POST /api/v1/portal/patient/verify-otp
 */
export async function verifyPatientOtpHandler(req: Request, res: Response): Promise<Response> {
  const { phone, otp, firstName, lastName, dateOfBirth, gender } = req.body;
  if (!phone || !otp) {
    throw AppError.badRequest('Phone number and OTP code are required');
  }

  const result = await verifyPatientOtp({ phone, otp, firstName, lastName, dateOfBirth, gender });
  return sendSuccess(res, result, 'Patient authenticated successfully');
}

/**
 * GET /api/v1/portal/patient/examinations
 */
export async function getPortalExaminationsHandler(req: Request, res: Response): Promise<Response> {
  const modality = req.query.modality as ModalityType | undefined;
  const exams = await getPortalExaminations(modality);
  return sendSuccess(res, exams, 'Examinations retrieved successfully');
}

/**
 * GET /api/v1/portal/patient/slots
 */
export async function getPortalSlotsHandler(req: Request, res: Response): Promise<Response> {
  const modality = req.query.modality as ModalityType;
  const date = req.query.date as string;

  if (!modality || !date) {
    throw AppError.badRequest('Both modality and date (YYYY-MM-DD) query parameters are required');
  }

  const slots = await getPortalSlots(modality, date);
  return sendSuccess(res, slots, 'Time slots retrieved successfully');
}

/**
 * POST /api/v1/portal/patient/book
 */
export async function bookPortalAppointmentHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { examDefinitionId, scheduledStart, equipmentId, clinicalNotes, priority } = req.body;
  if (!examDefinitionId || !scheduledStart) {
    throw AppError.badRequest('examDefinitionId and scheduledStart are required');
  }

  const result = await bookPortalAppointment(req.patient, {
    examDefinitionId,
    scheduledStart,
    equipmentId,
    clinicalNotes,
    priority,
  });

  return sendSuccess(res, result, 'Appointment booked successfully', 201);
}

/**
 * POST /api/v1/portal/patient/appointments/:id/referral
 */
export async function uploadPortalReferralHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const { fileName, fileType, referralNotes, doctorName, fileBase64, fileSize } = req.body;
  if (!fileName || !fileType) {
    throw AppError.badRequest('fileName and fileType are required');
  }

  const result = await uploadPortalReferral(req.patient.patientId, id, {
    fileName,
    fileType,
    referralNotes,
    doctorName,
    fileBase64,
    fileSize,
  });

  return sendSuccess(res, result, 'Prescription referral attached successfully');
}

/**
 * GET /api/v1/portal/patient/appointments/:id/referral-file
 */
export async function getPortalReferralFileHandler(req: Request, res: Response): Promise<void> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const fileData = await getPortalReferralFile(req.patient.patientId, id);

  res.setHeader('Content-Type', fileData.fileType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${fileData.fileName}"`);
  res.setHeader('Content-Length', fileData.fileSize);
  res.status(200).send(fileData.buffer);
}

/**
 * GET /api/v1/portal/patient/appointments/:id/instructions
 */
export async function getPortalInstructionsHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const result = await getPortalPreparationInstructions(req.patient.patientId, id);
  return sendSuccess(res, result, 'Preparation instructions retrieved successfully');
}

/**
 * POST /api/v1/portal/patient/appointments/:id/questionnaire
 */
export async function submitPortalQuestionnaireHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const { hasMetalImplants, hasAllergies, isPregnant, hasKidneyDisease, notes } = req.body;

  const result = await submitPortalQuestionnaire(req.patient.patientId, id, {
    hasMetalImplants: !!hasMetalImplants,
    hasAllergies: !!hasAllergies,
    isPregnant: !!isPregnant,
    hasKidneyDisease: !!hasKidneyDisease,
    notes,
  });

  return sendSuccess(res, result, 'Pre-visit safety questionnaire submitted');
}

/**
 * POST /api/v1/portal/patient/appointments/:id/deposit
 */
export async function payPortalAdvanceDepositHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const { amount, paymentMethod } = req.body;
  if (!amount || amount <= 0) {
    throw AppError.badRequest('Valid payment amount is required');
  }

  const result = await payPortalAdvanceDeposit(req.patient.patientId, id, {
    amount: Number(amount),
    paymentMethod: paymentMethod || 'ONLINE',
  });

  return sendSuccess(res, result, 'Advance deposit recorded successfully');
}

/**
 * POST /api/v1/portal/patient/appointments/:id/reschedule
 */
export async function reschedulePortalAppointmentHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const { newStart, reason } = req.body;
  if (!newStart) {
    throw AppError.badRequest('newStart ISO datetime is required');
  }

  const result = await reschedulePortalAppointment(req.patient.patientId, id, newStart, reason);
  return sendSuccess(res, result, 'Appointment rescheduled successfully');
}

/**
 * POST /api/v1/portal/patient/appointments/:id/cancel
 */
export async function cancelPortalAppointmentHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const { reason } = req.body;
  if (!reason) {
    throw AppError.badRequest('Cancellation reason is required');
  }

  const result = await cancelPortalAppointment(req.patient.patientId, id, reason);
  return sendSuccess(res, result, 'Appointment cancelled successfully');
}

/**
 * POST /api/v1/portal/patient/appointments/:id/remind
 */
export async function sendPortalReminderHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { id } = req.params;
  const { reminderType } = req.body;

  const result = await sendPortalAppointmentReminder(
    req.patient.patientId,
    id,
    reminderType === '2HR' ? '2HR' : '24HR'
  );
  return sendSuccess(res, result, 'Reminder notification dispatched');
}

/**
 * GET /api/v1/portal/patient/appointments
 */
export async function getPatientPortalAppointmentsHandler(req: Request, res: Response): Promise<Response> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const result = await getPatientPortalAppointments(req.patient.patientId);
  return sendSuccess(res, result, 'Patient appointments retrieved successfully');
}

/**
 * GET /api/v1/portal/patient/reports/:accessionNumber/viewer
 */
export async function getPatientReportViewerHandler(req: Request, res: Response): Promise<Response | void> {
  if (!req.patient) {
    throw AppError.unauthorized('Patient authentication required');
  }

  const { accessionNumber } = req.params;
  const result = await getPatientReportViewer(req.patient.patientId, accessionNumber);

  if (req.query.redirect === 'true') {
    return res.redirect(result.viewerUrl);
  }

  return sendSuccess(res, result, 'Imaging study viewer URL generated');
}

