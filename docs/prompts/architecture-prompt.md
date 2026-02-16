# Architecture Prompt

The following prompt was used to generate the project's architecture, folder structure, and auth flow.

---

```
You are a senior Frontend Architect. I have an already-initialized Next.js project (App Router, TypeScript). Implement the following production-ready architecture and auth flow:

Goal:
- Next.js App Router + React
- Supabase Authentication (email/password + OAuth-ready)
- My own backend for business APIs (all domain data comes from my backend)
- Frontend should attach Supabase access_token as Authorization: Bearer <token> when calling my backend
- Route groups: (public), (auth), (protected)
- Protected routes must redirect to /login if no valid session
- Auth routes should redirect to / if already logged in
- Clean, scalable folder structure and typed API utilities

Please DO NOT ask me questions. Make reasonable defaults.

1) Create this folder structure under src/:
src/
  app/
    layout.tsx
    globals.css
    (public)/
      page.tsx
      pricing/page.tsx
    (auth)/
      login/page.tsx
      callback/page.tsx
      reset-password/page.tsx
    (protected)/
      layout.tsx
      page.tsx
      settings/page.tsx
    api/
      auth/logout/route.ts
      health/route.ts
  modules/
    auth/
      ui/LoginForm.tsx
      api/auth.backend.api.ts
      lib/roles.ts
      model/types.ts
      index.ts
    user/
      api/user.api.ts
      model/types.ts
      model/schema.ts
      ui/UserCard.tsx
      lib/mapUser.ts
      index.ts
  services/
    supabase/
      client.ts
      server.ts
      middleware.ts
      types.ts
    http/
      backendClient.ts
      errors.ts
      headers.ts
    auth/
      requireSession.ts
      getSession.ts
  shared/
    ui/
    hooks/
    lib/
    config/
      env.ts
      routes.ts
    styles/tokens.css
  widgets/
    Header/
    Sidebar/
    PageShell/

2) Supabase integration:
- Use @supabase/supabase-js and @supabase/ssr with Next.js App Router
- Browser client, server client, middleware helper
- Zod-validated env variables

3) Auth routing:
- Next.js middleware.ts at project root
- Protect routes under (protected), redirect unauthed to /login
- Redirect authed users from auth pages to /
- Use Supabase server session in middleware

4) Protected layout:
- Server-side session check, redirect if no session
- Render PageShell with Header/Sidebar

5) Login UI:
- Email + password, Sign in / Sign up buttons
- Supabase browser client for auth
- Error display, redirect on success

6) Backend API client:
- backendFetch<T>(path, options) with baseUrl from env
- Auto-attaches Authorization header
- Server and client usage support
- BackendError normalization
- Example: getMe() calling /users/me with Zod validation and DTO mapping

7) Logout:
- API route handler with Supabase signOut
- Client-side logout button in Header

8) Provide complete code for every file. TypeScript must compile.

Constraints:
- Keep it generic (don't invent backend endpoints beyond /health, /users/me)
- Clean, minimal, production-grade
- Next.js App Router best practices (server components by default)
```
