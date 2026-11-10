import { apiClient } from '../lib/api';
import { ReferringDoctor, ExamDefinition, Equipment, ModalityType } from '../types';

export async function fetchReferringDoctors(search?: string): Promise<ReferringDoctor[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  const res = await apiClient<ReferringDoctor[]>(`/referring-doctors${query}`);
  return res.data;
}

export async function fetchExamDefinitions(modality?: ModalityType): Promise<ExamDefinition[]> {
  const query = modality ? `?modality=${modality}` : '';
  const res = await apiClient<ExamDefinition[]>(`/exam-definitions${query}`);
  return res.data;
}

export async function fetchEquipment(
  params?: ModalityType | { modality?: ModalityType; operationalOnly?: boolean }
): Promise<Equipment[]> {
  const modality = typeof params === 'string' ? params : params?.modality;
  const operationalOnly = typeof params === 'object' ? params?.operationalOnly : undefined;

  const query = new URLSearchParams();
  if (modality) query.set('modality', modality);
  if (operationalOnly) query.set('operationalOnly', 'true');

  const qs = query.toString();
  const res = await apiClient<Equipment[]>(`/equipment${qs ? `?${qs}` : ''}`);
  return res.data;
}

