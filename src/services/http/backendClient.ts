import { env } from '@/shared/config/env';
import { BackendError } from './errors';
import { buildAuthHeaders } from './headers';

export interface BackendFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Provide an access token directly (for server-side usage). */
  accessToken?: string | null;
}

/**
 * Typed fetch wrapper for your own backend.
 *
 * Server-side: pass `accessToken` explicitly (from getSession).
 * Client-side: pass `accessToken` from the browser Supabase client session.
 */
export async function backendFetch<T>(
  path: string,
  options: BackendFetchOptions = {},
): Promise<T> {
  const { accessToken, body, headers: customHeaders, ...rest } = options;

  const url = `${env.NEXT_PUBLIC_BACKEND_URL}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...buildAuthHeaders(accessToken ?? null),
    ...customHeaders,
  };

  const response = await fetch(url, {
    ...rest,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw await BackendError.fromResponse(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
