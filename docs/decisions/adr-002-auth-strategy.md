# ADR-002: Supabase Authentication with Token Forwarding

## Status

Accepted

## Context

The application requires:
- User authentication (email/password, with OAuth-ready infrastructure).
- Protected routes that redirect unauthenticated users.
- A custom backend API that must know the identity of the caller.
- Server-side rendering compatibility (no localStorage-dependent auth).

## Decision

### Auth provider: Supabase
Use Supabase Authentication via `@supabase/ssr` for cookie-based session management compatible with Next.js App Router.

### Session storage: Cookies
`@supabase/ssr` manages auth tokens as HTTP cookies. This enables:
- Server Components to access sessions.
- Middleware to validate sessions at the edge.
- No manual token management.

### Route protection: Middleware + Layout guard
- **Middleware** (`middleware.ts`) checks every request and redirects based on session state and path classification.
- **Protected layout** (`(protected)/layout.tsx`) calls `requireSession()` as a second validation layer.

### Backend integration: Token forwarding
The frontend forwards the Supabase `access_token` to the custom backend as an `Authorization: Bearer <token>` header. The backend validates this JWT independently using the Supabase JWT secret.

## Alternatives Considered

### Custom JWT auth server
Rejected. Supabase provides managed auth with email, OAuth, MFA, and session refresh out of the box. No need to maintain a custom auth server.

### NextAuth.js
Rejected. Adds an abstraction layer over Supabase that isn't needed. Direct Supabase integration is simpler and provides full control.

### localStorage tokens
Rejected. Incompatible with server-side rendering. Cookies work seamlessly across SSR, RSC, and middleware.

### Backend session management
Rejected. The backend validates the JWT on each request. No server-side session store is needed. This keeps the backend stateless and horizontally scalable.

## Consequences

**Positive:**
- Single auth provider (Supabase) for all auth flows.
- Backend remains auth-provider-agnostic (only needs JWT validation).
- No token duplication or manual refresh logic in the frontend.
- Works with SSR, RSC, and middleware.

**Negative:**
- Dependency on Supabase as the auth provider.
- Cookie size increases with Supabase session tokens.
- Middleware runs on every matched request (small latency cost for session refresh).

## Compliance

- All auth state comes from Supabase. No custom token creation.
- Backend calls always use `backendFetch` with `accessToken` parameter.
- Modules (except `auth`) never access Supabase directly.
