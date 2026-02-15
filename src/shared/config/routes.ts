export const ROUTES = {
  landing: '/',
  dashboard: '/dashboard',
  login: '/login',
  resetPassword: '/reset-password',
  callback: '/callback',
  settings: '/settings',
  pricing: '/pricing',
} as const;

/** Auth-only routes: redirect to dashboard if already logged in */
export const AUTH_ROUTES = [
  ROUTES.login,
  ROUTES.resetPassword,
  ROUTES.callback,
] as const;

/** Protected routes: redirect to login if not logged in */
export const PROTECTED_PATHS = ['/dashboard', '/settings'] as const;
