import type { Session, User } from '@supabase/supabase-js';

export type { Session, User };

export type SupabaseAuthResult =
  | { session: Session; user: User; error: null }
  | { session: null; user: null; error: string };
