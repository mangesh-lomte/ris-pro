import { apiClient } from '../lib/api';
import {
  ImagingOrder,
  ApiResponse,
  PaginatedData,
  ModalityType,
  OrderStatus,
  Priority,
  AuthorizationStatus,
  PayerType,
} from '../types';

export interface OrderListParams {
  page?: number;
  pageSize?: number;
  limit?: number;
  modality?: ModalityType;
  status?: OrderStatus;
  priority?: Priority;
  search?: string;
  patientId?: string;
  accessionNumber?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface CreateOrderData {
  patientId: string;
  modality: ModalityType;
  bodyPart: string;
  examinationName: string;
  clinicalIndication: string;
  referringDoctorId?: string;
  referringDoctorText?: string;
  contrastRequired?: boolean;
  contrastRequirement?: 'NONE' | 'ORAL' | 'IV' | 'BOTH';
  priority?: Priority;
  payerType?: PayerType;
  payerName?: string;
  insuranceProvider?: string;
  memberId?: string;
  policyNumber?: string;
  authorizationRequired?: boolean;
  authorizationStatus?: AuthorizationStatus;
  authorizationCode?: string;
  insuranceNotes?: string;
}

export interface UpdateOrderData {
  bodyPart?: string;
  examinationName?: string;
  clinicalIndication?: string;
  referringDoctorId?: string;
  referringDoctorText?: string;
  contrastRequired?: boolean;
  priority?: Priority;
  orderStatus?: OrderStatus;
  payerType?: PayerType;
  payerName?: string;
  memberId?: string;
  authorizationRequired?: boolean;
  authorizationStatus?: AuthorizationStatus;
  authorizationCode?: string;
  insuranceNotes?: string;
}

export async function fetchOrders(
  params: OrderListParams = {}
): Promise<ApiResponse<PaginatedData<ImagingOrder>>> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', params.page.toString());
  if (params.pageSize || params.limit) {
    query.set('pageSize', (params.pageSize || params.limit)!.toString());
  }
  if (params.modality) query.set('modality', params.modality);
  if (params.status) query.set('status', params.status);
  if (params.priority) query.set('priority', params.priority);
  if (params.search) query.set('search', params.search);
  if (params.patientId) query.set('patientId', params.patientId);
  if (params.accessionNumber) query.set('accessionNumber', params.accessionNumber);
  if (params.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params.dateTo) query.set('dateTo', params.dateTo);

  const qs = query.toString();
  return apiClient<PaginatedData<ImagingOrder>>(`/orders${qs ? `?${qs}` : ''}`);
}

export async function getOrder(id: string): Promise<ImagingOrder> {
  const res = await apiClient<ImagingOrder>(`/orders/${id}`);
  return res.data;
}

export async function createOrder(data: CreateOrderData): Promise<ImagingOrder> {
  const res = await apiClient<ImagingOrder>('/orders', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function updateOrder(id: string, data: UpdateOrderData): Promise<ImagingOrder> {
  const res = await apiClient<ImagingOrder>(`/orders/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return res.data;
}

export async function generateAccessionPreview(
  modality?: string
): Promise<{ accessionNumber: string; format: string }> {
  const query = modality ? `?modality=${modality}` : '';
  const res = await apiClient<{ accessionNumber: string; format: string }>(
    `/orders/generate-accession${query}`
  );
  return res.data;
}

export async function fetchOrderTimeline(id: string): Promise<any> {
  const res = await apiClient<any>(`/orders/${id}/tracking`);
  return res.data;
}

export async function syncOrderMwl(id: string): Promise<any> {
  const res = await apiClient<any>(`/orders/${id}/mwl-sync`, {
    method: 'POST',
  });
  return res.data;
}

export async function importHisOrder(payload: any): Promise<any> {
  const res = await apiClient<any>('/orders/import-his', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return res.data;
}
