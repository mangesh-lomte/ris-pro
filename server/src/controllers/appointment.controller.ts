import { Request, Response } from 'express';
import { z } from 'zod';
import { ModalityType, Priority, AppointmentStatus } from '@prisma/client';
import {
  createAppointment,
  rescheduleAppointment,
  cancelAppointment,
  markNoShowAppointment,
  checkInAppointment,
  getReceptionWaitingQueue,
  calculateSlotAvailability,
  listAppointments,
  getAppointmentById,
  allocateSlotStaffAndMachine,
  getBookingPrepCheck,
} from '../services/appointment.service';
import { sendSuccess } from '../utils/apiResponse';
import { AppError } from '../utils/appError';

export const createAppointmentSchema = z.object({
  patientId: z.string().min(1, 'Patient identifier is required'),
  imagingOrderId: z.string().min(1, 'Imaging order identifier is required'),
  equipmentId: z.string().optional(),
  examDefinitionId: z.string().optional(),
  scheduledStart: z.string().refine((val) => !isNaN(Date.parse(val)), 'Valid scheduled start ISO date/time required'),
  scheduledEnd: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  priority: z.nativeEnum(Priority).optional(),
  allowConflictOverride: z.boolean().optional(),
  overrideReason: z.string().trim().optional(),
  assignedRadiographer: z.string().trim().optional(),
  assignedNurse: z.string().trim().optional(),
});

export const allocateStaffMachineSchema = z.object({
  equipmentId: z.string().optional(),
  location: z.string().trim().optional(),
  radiographer: z.string().trim().optional(),
  nurse: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const rescheduleSchema = z.object({
  equipmentId: z.string().optional(),
  scheduledStart: z.string().refine((val) => !isNaN(Date.parse(val)), 'Valid new scheduled start date/time required'),
  reason: z.string().trim().min(2, 'Reschedule reason is required (min 2 chars)').max(500),
});

export const cancelSchema = z.object({
  reason: z.string().trim().min(2, 'Cancellation reason is required (min 2 chars)').max(500),
});

export const noShowSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export const checkInSchema = z.object({
  identityConfirmed: z.boolean().refine((val) => val === true, {
    message: 'Staff identity confirmation checkbox is required before patient check-in',
  }),
});

export const slotAvailabilitySchema = z.object({
  modality: z.nativeEnum(ModalityType, {
    errorMap: () => ({ message: 'Valid modality is required (CT, MRI, XRAY)' }),
  }),
  equipmentId: z.string().optional(),
  date: z.string().refine((val) => !isNaN(Date.parse(val)), 'Valid date required (YYYY-MM-DD)'),
  examDefinitionId: z.string().optional(),
});

export const appointmentQuerySchema = z.object({
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  pageSize: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 20)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : undefined)),
  date: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  patientId: z.string().optional(),
  modality: z.nativeEnum(ModalityType).optional(),
  equipmentId: z.string().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  priority: z.nativeEnum(Priority).optional(),
  search: z.string().optional(),
});

export async function getAppointments(req: Request, res: Response): Promise<Response> {
  const page = typeof req.query.page === 'number' ? req.query.page : 1;
  const pageSize =
    typeof req.query.pageSize === 'number'
      ? req.query.pageSize
      : typeof req.query.limit === 'number'
      ? req.query.limit
      : 20;

  const result = await listAppointments({
    page,
    pageSize,
    date: req.query.date as string | undefined,
    dateFrom: req.query.dateFrom as string | undefined,
    dateTo: req.query.dateTo as string | undefined,
    patientId: req.query.patientId as string | undefined,
    modality: req.query.modality as ModalityType | undefined,
    equipmentId: req.query.equipmentId as string | undefined,
    status: req.query.status as AppointmentStatus | undefined,
    priority: req.query.priority as Priority | undefined,
    search: req.query.search as string | undefined,
  });

  return sendSuccess(res, result, 'Appointments retrieved successfully');
}

export async function getAppointment(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Appointment identifier is required');

  const appointment = await getAppointmentById(id);
  return sendSuccess(res, appointment, 'Appointment record retrieved');
}

export async function create(req: Request, res: Response): Promise<Response> {
  const appointment = await createAppointment(req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, appointment, 'Appointment booked successfully', 201);
}

export async function reschedule(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Appointment identifier is required');

  const appointment = await rescheduleAppointment(id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, appointment, 'Appointment rescheduled successfully');
}

export async function cancel(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Appointment identifier is required');

  const appointment = await cancelAppointment(id, req.body.reason, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, appointment, 'Appointment cancelled and slot released');
}

export async function noShow(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Appointment identifier is required');

  const appointment = await markNoShowAppointment(id, req.body.reason, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, appointment, 'Appointment marked as No-Show');
}

export async function checkIn(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Appointment identifier is required');

  const result = await checkInAppointment(id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, result, result.queueMessage);
}

export async function getQueue(req: Request, res: Response): Promise<Response> {
  const date = req.query.date as string | undefined;
  const modality = req.query.modality as ModalityType | undefined;

  const queue = await getReceptionWaitingQueue({ date, modality });
  return sendSuccess(res, queue, 'Reception waiting queue retrieved');
}

export async function getAvailability(req: Request, res: Response): Promise<Response> {
  const modality = req.query.modality as ModalityType;
  const equipmentId = req.query.equipmentId as string | undefined;
  const date = req.query.date as string;
  const examDefinitionId = req.query.examDefinitionId as string | undefined;

  const availability = await calculateSlotAvailability({
    modality,
    equipmentId,
    date,
    examDefinitionId,
  });

  return sendSuccess(res, availability, 'Available slot candidates computed');
}

export async function allocateStaff(req: Request, res: Response): Promise<Response> {
  const { id } = req.params;
  if (!id) throw AppError.badRequest('Appointment identifier is required');

  const result = await allocateSlotStaffAndMachine(id, req.body, {
    userId: req.user?.id,
    ipAddress: req.ip || req.socket.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return sendSuccess(res, result, 'Staff and machine allocated to appointment slot');
}

export async function getPrepCheck(req: Request, res: Response): Promise<Response> {
  const examDefinitionId = req.query.examDefinitionId as string | undefined;
  const modality = req.query.modality as ModalityType | undefined;
  const contrastRequired = req.query.contrastRequired === 'true';

  const prepCheck = await getBookingPrepCheck({
    examDefinitionId,
    modality,
    contrastRequired,
  });

  return sendSuccess(res, prepCheck, 'Patient preparation instructions retrieved');
}

