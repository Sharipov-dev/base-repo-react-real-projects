# Routing

## Purpose

Document the URL structure, route group behavior, and the relationship between file paths and URLs.

## Route Map

| URL | Route Group | File Path | Auth Required |
|---|---|---|---|
| `/` | `(public)` | `app/(public)/page.tsx` | No |
| `/pricing` | `(public)` | `app/(public)/pricing/page.tsx` | No |
| `/login` | `(auth)` | `app/(auth)/login/page.tsx` | No (redirect if authed) |
| `/callback` | `(auth)` | `app/(auth)/callback/page.tsx` | No (redirect if authed) |
| `/reset-password` | `(auth)` | `app/(auth)/reset-password/page.tsx` | No (redirect if authed) |
| `/dashboard` | `(protected)` | `app/(protected)/dashboard/page.tsx` | Yes |
| `/settings` | `(protected)` | `app/(protected)/settings/page.tsx` | Yes |
| `/api/health` | API | `app/api/health/route.ts` | No |
| `/api/auth/logout` | API | `app/api/auth/logout/route.ts` | No |

## Route Groups

Next.js parenthesized folders create route groups. They affect layout nesting but **not** the URL.

### `(public)` — Open access
- No layout wrapper beyond root.
- Accessible to all visitors.

### `(auth)` — Authentication pages
- If the user has a valid session, middleware redirects to `/dashboard`.
- Contains login, callback, and password reset.

### `(protected)` — Authenticated access
- `layout.tsx` calls `requireSession()` and redirects to `/login` if no session.
- Wraps all children in `PageShell` (Header + Sidebar + content area).
- Middleware provides a first line of defense; the layout provides a second.

## Route Constants

All route paths are defined in `src/shared/config/routes.ts`:

```typescript
export const ROUTES = {
  landing: '/',
  dashboard: '/dashboard',
  login: '/login',
  resetPassword: '/reset-password',
  callback: '/callback',
  settings: '/settings',
  pricing: '/pricing',
} as const;
```

All navigation and redirects reference these constants. Never use hardcoded path strings.

## Adding a New Route

### Public route
1. Create `src/app/(public)/<route>/page.tsx`.
2. No additional configuration required.

### Protected route
1. Create `src/app/(protected)/<route>/page.tsx`.
2. Add the path to `PROTECTED_PATHS` in `src/shared/config/routes.ts`.
3. Add the path to `ROUTES` constant.
4. The existing `(protected)/layout.tsx` handles session enforcement and PageShell.

### Auth route
1. Create `src/app/(auth)/<route>/page.tsx`.
2. Add the path to `AUTH_ROUTES` in `src/shared/config/routes.ts`.
3. Add the path to `ROUTES` constant.

## Middleware Interaction

The root `middleware.ts` intercepts all non-static requests and:
1. Refreshes the Supabase session (cookie management).
2. Checks pathname against `PROTECTED_PATHS` and `AUTH_ROUTES`.
3. Redirects accordingly.

See [Middleware documentation](../infrastructure/middleware.md) for implementation details.
