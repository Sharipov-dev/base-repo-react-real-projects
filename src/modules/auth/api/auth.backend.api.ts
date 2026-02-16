import { backendFetch } from '@/services/http/backendClient';
import type { AuthProfile } from '../model/types';

/** Sync the Supabase user with your backend after login/signup. */
export async function syncProfile(accessToken: string): Promise<AuthProfile> {
  return backendFetch<AuthProfile>('/auth/profile', {
    method: 'POST',
    accessToken,
  });
}
