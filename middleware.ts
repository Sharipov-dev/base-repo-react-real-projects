import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/services/supabase/middleware';
import { AUTH_ROUTES, PROTECTED_PATHS, ROUTES } from '@/shared/config/routes';

const authPaths: readonly string[] = AUTH_ROUTES;
const protectedPaths: readonly string[] = PROTECTED_PATHS;

function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

function isAuthPath(pathname: string): boolean {
  return authPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request);
  const { pathname } = request.nextUrl;

  // Authenticated user trying to access auth pages -> redirect to dashboard
  if (user && isAuthPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.dashboard;
    return NextResponse.redirect(url);
  }

  // Unauthenticated user trying to access protected pages -> redirect to login
  if (!user && isProtectedPath(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = ROUTES.login;
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)',
  ],
};
