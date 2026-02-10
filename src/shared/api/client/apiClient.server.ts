import 'server-only';

import { cookies, headers } from 'next/headers';
import { ApiError, NetworkError } from './errors';

const BASE_URL = process.env.BACKEND_URL ?? '';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Override base URL for this request */
  baseUrl?: string;
  /** Forward browser cookies to the backend */
  forwardCookies?: boolean;
  /** Forward authorization header to the backend */
  forwardAuth?: boolean;
}

/**
 * Server-side fetch wrapper.
 * - Runs only on the server (enforced by 'server-only')
 * - Can forward cookies and Authorization header to the backend
 */
export async function serverFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    baseUrl = BASE_URL,
    body,
    headers: customHeaders,
    forwardCookies = false,
    forwardAuth = true,
    ...rest
  } = options;

  const url = `${baseUrl}${path}`;

  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (forwardCookies) {
    const cookieStore = await cookies();
    const cookieHeader = cookieStore.toString();
    if (cookieHeader) {
      reqHeaders['Cookie'] = cookieHeader;
    }
  }

  if (forwardAuth) {
    const headerStore = await headers();
    const auth = headerStore.get('authorization');
    if (auth) {
      reqHeaders['Authorization'] = auth;
    }
  }

  try {
    const response = await fetch(url, {
      ...rest,
      headers: reqHeaders,
      body: body ? JSON.stringify(body) : undefined,
      // Opt out of Next.js cache by default for mutable server calls
      cache: rest.cache ?? 'no-store',
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new ApiError(response.status, response.statusText, errorBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new NetworkError('Server fetch failed', error);
  }
}
