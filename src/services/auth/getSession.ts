import { createServerSupabaseClient } from '@/services/supabase/server';
import type { Session, User } from '@/services/supabase/types';

type SessionResult =
  | { session: Session; user: User }
  | { session: null; user: null };

export async function getSession(): Promise<SessionResult> {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { session: null, user: null };
  }

  // Always validate via getUser for server-side security
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { session: null, user: null };
  }

  return { session, user };
}

export async function getAccessToken(): Promise<string | null> {
  const { session } = await getSession();
  return session?.access_token ?? null;
}
