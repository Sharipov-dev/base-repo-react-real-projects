'use client';

/**
 * Client-side token storage.
 *
 * By default Supabase stores sessions in cookies via @supabase/ssr,
 * so this module is only needed if you must access the token in JS
 * (e.g., for a third-party SDK that requires a Bearer token).
 *
 * WARNING: Prefer cookies over localStorage for security.
 * This is intentionally minimal — use only if absolutely necessary.
 */

const TOKEN_KEY = 'sb-access-token';

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  sessionStorage.removeItem(TOKEN_KEY);
}
