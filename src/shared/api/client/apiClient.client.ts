'use client';

import { ApiError, NetworkError, AbortError } from './errors';

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? '';

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Override base URL for this request */
  baseUrl?: string;
}

/**
 * Browser-side fetch wrapper.
 * - JSON serialization
 * - Normalized error handling
 * - AbortController support
 */
export async function clientFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { baseUrl = BASE_URL, body, headers: customHeaders, ...rest } = options;
  const url = `${baseUrl}${path}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  try {
    const response = await fetch(url, {
      ...rest,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new ApiError(response.status, response.statusText, errorBody);
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AbortError();
    }

    throw new NetworkError('Network request failed', error);
  }
}
