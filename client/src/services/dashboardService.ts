import { apiClient } from '../lib/api';
import { DashboardOverviewResponse, DashboardSearchResultItem } from '../types';

export async function fetchDashboardOverview(): Promise<DashboardOverviewResponse> {
  const res = await apiClient<DashboardOverviewResponse>('/dashboard/overview');
  return res.data;
}

export async function searchDashboardGlobal(query: string): Promise<DashboardSearchResultItem[]> {
  if (!query || query.trim().length < 2) {
    return [];
  }
  const res = await apiClient<DashboardSearchResultItem[]>(`/dashboard/search?q=${encodeURIComponent(query.trim())}`);
  return res.data;
}

