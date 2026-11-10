import { apiClient } from '../lib/api';
import {
  Patient,
  ApiResponse,
  PaginatedData,
  CandidateDuplicatePatient,
  Gender,
} from '../types';

export interface PatientListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  sortBy?: 'createdAt' | 'lastName' | 'firstName';
  sortOrder?: 'asc' | 'desc';
}

export interface CreatePatientData {
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string;
  alternatePhone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  bypassDuplicateWarning?: boolean;
}

export interface UpdatePatientData {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  phone?: string;
  alternatePhone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  isActive?: boolean;
}

export interface DuplicateCheckResult {
  hasPotentialDuplicates: boolean;
  count: number;
  candidates: CandidateDuplicatePatient[];
}

export async function fetchPatients(
  params: PatientListParams = {}
): Promise<ApiResponse<PaginatedData<Patient>>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize || params.limit) {
    query.set('pageSize', (params.pageSize || params.limit)!.toString());
  }
  if (params.search) query.set('search', params.search);
  if (params.sortBy) query.set('sortBy', params.sortBy);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);

  const qs = query.toString();
  return apiClient<PaginatedData<Patient>>(`/patients${qs ? `?${qs}` : ''}`);
}

export async function getPatient(id: string): Promise<Patient> {
  const res = await apiClient<Patient>(`/patients/${id}`);
  return res.data;
}

export async function createPatient(data: CreatePatientData): Promise<Patient> {
  const res = await apiClient<Patient>('/patients', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updatePatient(id: string, data: UpdatePatientData): Promise<Patient> {
  const res = await apiClient<Patient>(`/patients/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function checkDuplicatePatient(data: {
  phone: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}): Promise<DuplicateCheckResult> {
  const res = await apiClient<DuplicateCheckResult>('/patients/duplicate-check', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function generatePatientIdPreview(): Promise<{ patientId: string; format: string }> {
  const res = await apiClient<{ patientId: string; format: string }>('/patients/generate-id');
  return res.data;
}
