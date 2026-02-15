import { redirect } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';
import { getSession } from './getSession';
import type { Session, User } from '@/services/supabase/types';

export async function requireSession(): Promise<{ session: Session; user: User }> {
  const result = await getSession();

  if (!result.session) {
    redirect(ROUTES.login);
  }

  return result;
}
