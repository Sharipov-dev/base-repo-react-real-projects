# Authentication Flow

## Purpose

Document how authentication works end-to-end: from login to session management to backend token forwarding.

## Architecture

```
┌──────────┐     ┌──────────┐     ┌───────────────┐     ┌─────────┐
│  Browser  │────▶│ Supabase │────▶│  Next.js App  │────▶│ Backend │
│           │◀────│   Auth   │◀────│  (middleware)  │     │  (JWT)  │
└──────────┘     └──────────┘     └───────────────┘     └─────────┘
```

- **Supabase** owns authentication (user accounts, sessions, tokens).
- **Next.js** manages session cookies via `@supabase/ssr` and protects routes.
- **Backend** receives the Supabase `access_token` as a Bearer token and validates it independently.

## Login Flow

1. User submits email/password on `/login` via `LoginForm`.
2. `LoginForm` calls `supabase.auth.signInWithPassword()` using the browser client.
3. Supabase returns a session. `@supabase/ssr` stores it in cookies automatically.
4. `router.push('/dashboard')` + `router.refresh()` triggers navigation.
5. Middleware refreshes the session and allows access to `/dashboard`.
6. `(protected)/layout.tsx` calls `requireSession()` — confirms session server-side.
7. Dashboard renders.

## Sign Up Flow

Same as login, but uses `supabase.auth.signUp()`. If email confirmation is enabled in Supabase, the user must verify before the session becomes valid.

## OAuth Flow

1. User initiates OAuth (e.g., Google) via `supabase.auth.signInWithOAuth()`.
2. Supabase redirects to the provider, then back to `/callback`.
3. `callback/page.tsx` listens for `SIGNED_IN` event and redirects to `/dashboard`.

## Session Management

### Cookie-based sessions

`@supabase/ssr` manages Supabase auth tokens as HTTP cookies. This allows:
- Server Components to read the session without client-side JS.
- Middleware to validate sessions at the edge.
- No manual token storage in localStorage.

### Session refresh

The middleware helper `updateSession()` in `services/supabase/middleware.ts`:
1. Creates a Supabase server client bound to the request cookies.
2. Calls `supabase.auth.getUser()` which refreshes the token if needed.
3. Forwards updated cookies to the response.

This runs on **every request** matched by the middleware config.

### Server-side session access

`services/auth/getSession.ts` provides:
- `getSession()` — returns `{ session, user }` or `{ null, null }`.
- `getAccessToken()` — returns the `access_token` string or `null`.

`services/auth/requireSession.ts` provides:
- `requireSession()` — returns `{ session, user }` or redirects to `/login`.

**Important:** `getSession()` calls both `getSession()` and `getUser()`. The `getUser()` call is essential — it validates the token server-side rather than trusting the JWT claims from cookies alone.

## Middleware Protection

`middleware.ts` at project root:

```
Request → updateSession() → check pathname → redirect or continue
```

| Condition | Action |
|---|---|
| Authenticated + auth path (`/login`, etc.) | Redirect to `/dashboard` |
| Unauthenticated + protected path (`/dashboard`, `/settings`) | Redirect to `/login` |
| All other cases | Continue to page |

Paths are checked against `PROTECTED_PATHS` and `AUTH_ROUTES` from `shared/config/routes.ts`.

## Protected Layout (Defense in Depth)

`(protected)/layout.tsx` calls `requireSession()` as a second layer of protection. This handles:
- Direct navigation bypassing middleware (edge cases).
- Session expiration between middleware execution and page render.

## Token Forwarding to Backend

When the frontend calls the custom backend:

```typescript
// Server-side
const token = await getAccessToken();
const user = await getMe(token);

// Client-side
const { data: { session } } = await supabase.auth.getSession();
const data = await backendFetch('/endpoint', { accessToken: session?.access_token });
```

The `backendFetch` function attaches the token as `Authorization: Bearer <token>`.

The backend validates this JWT independently using the Supabase JWT secret. The frontend never creates, modifies, or duplicates tokens.

## Logout Flow

1. Header's logout button calls `supabase.auth.signOut()` (client-side).
2. Supabase clears the session and cookies.
3. `router.push('/login')` + `router.refresh()` navigates away.

Alternative: `POST /api/auth/logout` route handler calls `signOut()` server-side and redirects.

## Why This Approach

| Decision | Rationale |
|---|---|
| Supabase for auth | Managed service. Handles email, OAuth, MFA. No custom auth server needed. |
| Cookie-based sessions | Works with SSR/RSC. No localStorage token management. |
| Middleware + layout guard | Defense in depth. Middleware is fast (edge). Layout is authoritative (server). |
| Token forwarding | Backend stays auth-provider-agnostic. Validates JWT independently. |
| No JWT duplication | Single source of truth for tokens. Less surface area for token leaks. |
