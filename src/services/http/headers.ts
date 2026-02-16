/**
 * Build Authorization headers from a Supabase access token.
 */
export function buildAuthHeaders(accessToken: string | null): HeadersInit {
  if (!accessToken) return {};
  return { Authorization: `Bearer ${accessToken}` };
}
