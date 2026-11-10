import { apiClient } from '../lib/api';
import {
  Appointment,
  ApiResponse,
  PaginatedData,
  ModalityType,
  AppointmentStatus,
  Priority,
  SlotAvailabilityResponse,
} from '../types';

export interface AppointmentListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  date?: string;
  dateFrom?: string;
  dateTo?: string;
  patientId?: string;
  modality?: ModalityType;
  equipmentId?: string;
  status?: AppointmentStatus;
  priority?: Priority;
  search?: string;
}

export interface CreateAppointmentData {
  patientId: string;
  imagingOrderId: string;
  equipmentId?: string;
  examDefinitionId?: string;
  scheduledStart: string;
  scheduledEnd?: string;
  durationMinutes?: number;
  notes?: string;
  priority?: Priority;
}

export interface RescheduleAppointmentData {
  equipmentId?: string;
  scheduledStart: string;
  reason: string;
}

export interface CheckInResponse {
  appointment: Appointment;
  tokenNumber: string;
  checkedInAt: string;
  queueMessage: string;
}

export async function fetchAppointments(
  params: AppointmentListParams = {}
): Promise<ApiResponse<PaginatedData<Appointment>>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize || params.limit) {
    query.set('pageSize', (params.pageSize || params.limit)!.toString());
  }
  if (params.date) query.set('date', params.date);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);
  if (params.patientId) query.set('patientId', params.patientId);
  if (params.modality) query.set('modality', params.modality);
  if (params.equipmentId) query.set('equipmentId', params.equipmentId);
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return apiClient<PaginatedData<Appointment>>(`/appointments${qs ? `?${qs}` : ''}`);
}

export async function getAppointment(id: string): Promise<Appointment> {
  const res = await apiClient<Appointment>(`/appointments/${id}`);
  return res.data;
}

export async function createAppointment(data: CreateAppointmentData): Promise<Appointment> {
  const res = await apiClient<Appointment>('/appointments', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function rescheduleAppointment(
  id: string,
  data: RescheduleAppointmentData
): Promise<Appointment> {
  const res = await apiClient<Appointment>(`/appointments/${id}/reschedule`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function cancelAppointment(id: string, reason: string): Promise<Appointment> {
  const res = await apiClient<Appointment>(`/appointments/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res.data;
}

export async function markNoShowAppointment(id: string, reason?: string): Promise<Appointment> {
  const res = await apiClient<Appointment>(`/appointments/${id}/no-show`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  return res.data;
}

export async function checkInAppointment(
  id: string,
  payload: { identityConfirmed: boolean; insuranceVerified?: boolean; preScanInstructionsConfirmed?: boolean } | boolean
): Promise<CheckInResponse> {
  const body = typeof payload === 'boolean' ? { identityConfirmed: payload } : payload;
  const res = await apiClient<CheckInResponse>(`/appointments/${id}/check-in`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}

export async function fetchSlotAvailability(params: {
  modality: ModalityType;
  equipmentId?: string;
  date: string;
  examDefinitionId?: string;
}): Promise<SlotAvailabilityResponse> {
  const query = new URLSearchParams();
  query.set('modality', params.modality);
  if (params.equipmentId) query.set('equipmentId', params.equipmentId);
  query.set('date', params.date);
  if (params.examDefinitionId) query.set('examDefinitionId', params.examDefinitionId);

  const res = await apiClient<SlotAvailabilityResponse>(
    `/scheduling/availability?${query.toString()}`
  );
  return res.data;
}

export async function fetchReceptionQueue(params: {
  date?: string;
  modality?: ModalityType;
} = {}): Promise<Appointment[]> {
  const query = new URLSearchParams();
  if (params.date) query.set('date', params.date);
  if (params.modality) query.set('modality', params.modality);

  const qs = query.toString();
  const res = await apiClient<Appointment[]>(`/reception/queue${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function allocateStaffMachine(
  appointmentId: string,
  data: {
    equipmentId?: string;
    location?: string;
    radiographer?: string;
    nurse?: string;
    notes?: string;
  }
): Promise<any> {
  const res = await apiClient<any>(`/appointments/${appointmentId}/allocation`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function fetchPreparationCheck(params: {
  examDefinitionId?: string;
  modality?: string;
  contrastRequired?: boolean;
} = {}): Promise<any> {
  const query = new URLSearchParams();
  if (params.examDefinitionId) query.set('examDefinitionId', params.examDefinitionId);
  if (params.modality) query.set('modality', params.modality);
  if (params.contrastRequired !== undefined) query.set('contrastRequired', params.contrastRequired.toString());

  const qs = query.toString();
  const res = await apiClient<any>(`/appointments/prep-check${qs ? `?${qs}` : ''}`);
  return res.data;
}

