import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getAuthToken } from './auth';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  // Get auth token for authenticated requests
  const token = await getAuthToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options?.headers,
  };

  // Add auth header if token is available
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  // Path already includes /api prefix from API_ROUTES
  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || error.message || 'Request failed');
  }

  return res.json();
}
