import { apiClient } from '../lib/api';
import { ImagingOrder, ApiResponse, ModalityType, OrderStatus } from '../types';

export interface OrderListParams {
  page?: number;
  limit?: number;
  modality?: ModalityType;
  status?: OrderStatus;
  search?: string;
}

export async function fetchOrders(params: OrderListParams = {}): Promise<ApiResponse<ImagingOrder[]>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.modality) query.set('modality', params.modality);
  if (params.status) query.set('status', params.status);
  if (params.search) query.set('search', params.search);

  const qs = query.toString();
  return apiClient<ImagingOrder[]>(`/orders${qs ? `?${qs}` : ''}`);
}

export async function generateAccessionPreview(): Promise<{ accessionNumber: string; format: string }> {
  const res = await apiClient<{ accessionNumber: string; format: string }>('/orders/generate-accession');
  return res.data;
}
