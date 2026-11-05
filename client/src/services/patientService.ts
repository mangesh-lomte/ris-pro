import { apiClient } from '../lib/api';
import { Patient, ApiResponse } from '../types';

export interface PatientListParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function fetchPatients(params: PatientListParams = {}): Promise<ApiResponse<Patient[]>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return apiClient<Patient[]>(`/patients${qs ? `?${qs}` : ''}`);
}

export async function generatePatientIdPreview(): Promise<{ patientId: string; format: string }> {
  const res = await apiClient<{ patientId: string; format: string }>('/patients/generate-id');
  return res.data;
}
