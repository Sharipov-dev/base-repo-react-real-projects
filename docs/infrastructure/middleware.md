# Middleware

## Purpose

Document the Next.js middleware behavior, configuration, and interaction with Supabase session management.

## Location

`middleware.ts` at the project root (required by Next.js convention).

## Execution

Middleware runs on **every request** matching the configured paths, before the route handler or page renders.

## Matcher Configuration

```typescript
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/).*)',
  ],
};
```

**Excluded:**
- `_next/static` — Static assets
- `_next/image` — Optimized images
- `favicon.ico`, `sitemap.xml`, `robots.txt` — Standard files
- `api/` — API route handlers

**Included:** All page routes.

## Flow

```
Request
    │
    ▼
updateSession(request)          ← services/supabase/middleware.ts
    │  (refreshes Supabase session cookies)
    │  (returns { user, supabaseResponse })
    ▼
Check pathname
    │
    ├── User + auth path (/login, /reset-password, /callback)
    │   → Redirect to /dashboard
    │
    ├── No user + protected path (/dashboard, /settings)
    │   → Redirect to /login
    │
    └── Otherwise
        → Return supabaseResponse (continue)
```

## `updateSession()` Helper

Located in `services/supabase/middleware.ts`.

1. Creates a Supabase server client with cookie read/write access.
2. Calls `supabase.auth.getUser()` — this validates and potentially refreshes the session.
3. Forwards updated cookies from Supabase to the response.

This is critical: without this, Supabase sessions would expire and not refresh in a server-rendered context.

## Route Classification

Routes are classified using constants from `shared/config/routes.ts`:

```typescript
const authPaths: readonly string[] = AUTH_ROUTES;     // ['/login', '/reset-password', '/callback']
const protectedPaths: readonly string[] = PROTECTED_PATHS;  // ['/dashboard', '/settings']
```

Path matching includes sub-paths: `/settings/profile` is protected because it starts with `/settings`.

## Adding a Protected Path

1. Add the path to `PROTECTED_PATHS` in `shared/config/routes.ts`.
2. No middleware code changes required.

## Defense in Depth

Middleware is the first layer of route protection. The `(protected)/layout.tsx` provides a second layer by calling `requireSession()`. This dual-guard approach handles edge cases where:
- Session expires between middleware execution and page render.
- Middleware is bypassed in development or through misconfiguration.
