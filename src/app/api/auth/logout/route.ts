import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/services/supabase/server';
import { ROUTES } from '@/shared/config/routes';

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = ROUTES.login;
  return NextResponse.redirect(url, { status: 302 });
}
