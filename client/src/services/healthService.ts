import { apiClient } from '../lib/api';
import { SystemHealthData } from '../types';

export async function fetchHealth(): Promise<SystemHealthData> {
  const res = await apiClient<SystemHealthData>('/health');
  return res.data;
}
