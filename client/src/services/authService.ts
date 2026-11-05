import { apiClient, setAuthToken, removeAuthToken } from '../lib/api';
import { AuthUser } from '../types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  user: AuthUser;
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const res = await apiClient<LoginResponseData>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });

  setAuthToken(res.data.token);
  return res.data.user;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const res = await apiClient<AuthUser>('/auth/me');
  return res.data;
}

export function logout(): void {
  removeAuthToken();
}
