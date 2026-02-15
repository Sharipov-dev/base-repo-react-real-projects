# CLAUDE.md — Project Context for Claude Code

## Project

RoadTrack frontend. Next.js 15 (App Router), React 19, TypeScript 5, Tailwind CSS.
Authentication via Supabase. Business data from a custom backend. React Query on client.

## Commands

```bash
npm run dev      # Start dev server (port 3000)
npm run build    # Production build
npm run lint     # ESLint
npx tsc --noEmit # Type-check without emitting
```

## Architecture (feature-sliced)

```
src/
  app/            # Next.js routes, layouts, API routes (BFF)
  features/       # Business features (auth, orders, …)
  entities/       # Domain types (user, order, …)
  shared/         # Reusable infra: API clients, auth helpers, UI components
  middleware.ts   # Route protection (Supabase session check)
```

### Layers — dependency rule

`app → features → entities → shared`. Never import upward. `shared` imports nothing from the project.

### Feature structure

Every feature follows:
```
features/<name>/
  ui/           # React components ("use client" only here)
  model/        # Hooks, state logic
  api/          # *.client.ts (browser), *.server.ts (server-only)
  types.ts      # Feature-specific types/DTOs
  index.ts      # Public API barrel export
```

Only import features through their `index.ts`. Never reach into internal paths from outside the feature.

### Server vs Client files

- `*.server.ts` — runs only on the server. Must import `'server-only'` at the top. Can access cookies, headers, env vars without `NEXT_PUBLIC_` prefix.
- `*.client.ts` — runs in the browser. Must have `'use client'` at the top when containing hooks/components. Uses `NEXT_PUBLIC_*` env vars only.

Do not mix server and client code in the same file.

## Key conventions

- **TypeScript strict mode**. No `any`. No `@ts-ignore`. Explicitly type function params and return types for public APIs.
- **`"use client"` only where needed** — components with hooks, event handlers, or browser APIs. Pages and layouts stay as server components unless they must be client.
- **Imports use `@/*` alias** (maps to `src/*`). No relative imports that escape the current layer.
- **No default exports** except for Next.js pages/layouts/route handlers (required by framework).
- **Naming**: PascalCase for components/types, camelCase for functions/variables, kebab-case for directories.
- **Short files**. One component/hook/function per file. Max ~100 lines per file — split if larger.

## Auth flow

1. Supabase handles sessions via cookies (`@supabase/ssr`).
2. `middleware.ts` intercepts protected routes, calls `supabase.auth.getUser()`, redirects to `/login` if no session.
3. Server components call `requireSession()` from `shared/lib/auth/session.server.ts`.
4. Client login goes through `features/auth/api/auth.client.ts` → Supabase `signInWithPassword`.
5. **Never store tokens in localStorage.** Supabase SSR handles cookie-based storage.

## API calls

- **Browser → backend**: Use `clientFetch()` from `shared/api/client/apiClient.client.ts`. Base URL: `NEXT_PUBLIC_BACKEND_URL`.
- **Server → backend**: Use `serverFetch()` from `shared/api/client/apiClient.server.ts`. Base URL: `BACKEND_URL`. Forwards cookies/auth headers.
- **BFF routes** (`app/api/*`): Only when the client cannot call the backend directly (e.g., file uploads, secret API keys). Validate session before proxying.
- **DTO mapping**: Backend responses (snake_case) are mapped to domain types (camelCase) in `shared/api/mapping/dto.ts`.
- **Error handling**: All API errors normalize to `ApiError` / `NetworkError` / `AbortError` from `shared/api/client/errors.ts`.
- **Retry**: `withRetry()` from `shared/api/client/retry.ts` — exponential backoff, retries only 5xx by default.

## React Query

- `QueryProvider` lives in `app/providers.tsx` (wraps entire app).
- Query hooks live in `features/<name>/model/use*Query.ts`.
- Query keys: `['resource-name', params]`.
- Default stale time: 60s. Default retry: 1.

## Adding a new feature

1. Create `src/features/<name>/` with `ui/`, `model/`, `api/`, `types.ts`, `index.ts`.
2. Domain types go in `src/entities/<name>/types.ts` + `index.ts`.
3. If a new DTO is needed, add mapper in `shared/api/mapping/dto.ts`.
4. If a new protected route, add the segment to `PROTECTED_SEGMENTS` in `middleware.ts`.
5. Export public API from `features/<name>/index.ts`.

## Adding a new API route (BFF)

1. Create `src/app/api/<name>/route.ts`.
2. Check auth with `getSession()` or `requireSession()`.
3. Proxy to backend using `serverFetch()` or raw `fetch` for non-JSON (e.g., form data).
4. Never expose server-only secrets to the response.

## Environment variables

| Variable | Side | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Both | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Both | Supabase anonymous key |
| `BACKEND_URL` | Server | Backend base URL (not exposed to browser) |
| `NEXT_PUBLIC_BACKEND_URL` | Client | Backend base URL (exposed to browser) |

## Design to code

When the user provides a screenshot or mockup:

1. Read the image file directly (Claude Code supports PNG, JPG, etc.).
2. Break the design into components following the layer rules: reusable pieces → `shared/ui/`, feature-specific → `features/<name>/ui/`.
3. Use **Tailwind CSS only**. Match the design's spacing, colors, and typography. Use our custom config: Inter font, accent `#10B981`.
4. Reuse existing `shared/ui` components (Button, etc.) before creating new ones.
5. Type all component props with explicit interfaces.
6. Design screenshots live in `docs/designs/` for reference.

See `docs/design-to-code.md` for full workflow and prompt templates.

## Do not

- Use `pages/` router patterns.
- Add UI libraries (no MUI, Chakra, etc.) — use Tailwind + `shared/ui` components.
- Put business logic in `app/` — pages only compose features.
- Import from `node_modules` without checking if it's already a dependency in `package.json`.
- Create files outside the established layer structure without discussion.
