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

export function formatSafeErrorMessage(err: unknown, fallback = 'Unable to connect to service.'): string {
  if (!err) return fallback;
  const raw =
    err instanceof ApiError
      ? err.message
      : err instanceof Error
      ? err.message
      : typeof err === 'string'
      ? err
      : (err as any)?.response?.data?.message || fallback;

  if (
    raw.includes('Failed to fetch') ||
    raw.includes('ECONNREFUSED') ||
    raw.includes('ENOTFOUND') ||
    raw.includes('NetworkError') ||
    raw.includes('socket') ||
    raw.includes('at ') ||
    raw.includes('Bearer ') ||
    raw.includes('password')
  ) {
    return 'RIS network service is currently unreachable. Please check connection.';
  }
  return raw;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getAuthToken();

  const optionsHeaders = (options.headers as Record<string, string>) || {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...optionsHeaders,
  };

  if (token && !optionsHeaders['Authorization'] && !optionsHeaders['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(
      'Unable to connect to the RIS server. Please verify network connectivity.',
      0,
      undefined,
      'NETWORK_ERROR'
    );
  }

  const data = await response.json().catch(() => ({
    success: false,
    message: 'Unable to parse server response',
  }));

  if (!response.ok || !data.success) {
    throw new ApiError(
      formatSafeErrorMessage(data.message, 'An error occurred while contacting the RIS server'),
      response.status,
      data.error?.details,
      data.error?.code
    );
  }

  return data as ApiResponse<T>;
}

