import { ApiResponse } from '../types';

const API_BASE = '/api/v1';

export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;
  public code?: string;

  constructor(message: string, statusCode: number, details?: unknown, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem('ris_auth_token');
}

export function setAuthToken(token: string): void {
  localStorage.setItem('ris_auth_token', token);
}

export function removeAuthToken(): void {
  localStorage.removeItem('ris_auth_token');
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Unable to parse server response',
  }));

  if (!response.ok || !data.success) {
    throw new ApiError(
      data.message || 'An error occurred while contacting the RIS server',
      response.status,
      data.error?.details,
      data.error?.code
    );
  }

  return data as ApiResponse<T>;
}
