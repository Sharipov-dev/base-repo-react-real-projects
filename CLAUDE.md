# CLAUDE.md — Project Rules for AI-Assisted Development

## Project Overview

RoadTrack frontend. Next.js 15 App Router, TypeScript strict, Tailwind CSS, Supabase Auth, custom backend API.

## Project Rules

- Server Components by default. Only use `'use client'` when interactivity is required.
- All imports use `@/` path alias. No relative traversals (`../../`).
- No `any` types. No `as Type` assertions on API data. Use Zod validation.
- No `console.log` in production code. Use proper error handling.
- All route paths come from `@/shared/config/routes.ts`. No hardcoded path strings.
- All env vars come from `@/shared/config/env.ts`. No direct `process.env` access.

## Architecture Rules

Five layers, strict dependency direction:

```
app/ → widgets/ → modules/ → services/ → shared/
```

- `app/` imports from any layer.
- `widgets/` imports from `shared/` only. Receives data as props.
- `modules/` imports from `services/` and `shared/`. Never from other modules.
- `services/` imports from `shared/` only.
- `shared/` imports from nothing internal. Only external packages.

## Folder Responsibilities

| Folder | Contains | Does NOT contain |
|---|---|---|
| `src/app/` | Pages, layouts, API routes, loading/error boundaries | Business logic, API clients, reusable components |
| `src/modules/` | Domain logic: API functions, types, domain UI, mappers | Infrastructure clients, generic UI, route definitions |
| `src/services/` | Supabase clients, fetch wrapper, auth guards, error classes | Business logic, UI components, domain types |
| `src/shared/` | Generic UI, config, hooks, utilities | Domain logic, API calls, Supabase code |
| `src/widgets/` | Layout blocks (Header, Sidebar, PageShell) | Business logic, API calls, page content |

## Supabase Rules

- Browser client: `@/services/supabase/client.ts` → `createClient()`.
- Server client: `@/services/supabase/server.ts` → `createServerSupabaseClient()`.
- Middleware: `@/services/supabase/middleware.ts` → `updateSession()`.
- **Only `modules/auth/` and `services/auth/` may call Supabase auth methods directly.**
- **Other modules never import from `@/services/supabase/`.** They use `backendFetch` with an `accessToken`.

## Backend Integration Rules

- All backend API calls go through `backendFetch<T>()` from `@/services/http/backendClient.ts`.
- No raw `fetch()` to the backend anywhere.
- Server-side: pass `accessToken` from `getAccessToken()`.
- Client-side: pass `accessToken` from `supabase.auth.getSession()`.
- All responses must be validated with Zod schemas before use.
- All DTOs must be mapped to UI models via mapper functions.
- Errors are instances of `BackendError` from `@/services/http/errors.ts`.

## Code Generation Constraints

When generating code:
- **Do not rewrite files you did not change.** Output only modified files.
- **Do not add features beyond what was requested.**
- **Do not refactor surrounding code** when fixing a bug or adding a feature.
- **Do not add comments, docstrings, or type annotations** to code you did not modify.
- **Do not create utility abstractions** for one-time operations.
- **Do not add error handling** for scenarios that cannot occur.
- **Keep responses concise.** No preamble, no summary unless requested.

## Performance Guidelines

- Use server components for data fetching. Avoid client-side fetch when server fetch is possible.
- React Query (`staleTime: 60s`, `retry: 1`) is configured in `app/providers.tsx`.
- Avoid unnecessary `'use client'` — it creates a client bundle boundary.
- Colocate data fetching with the component that needs it (in server components).

## Token Optimization Strategy

When responding to requests:
- Output only changed files, not the entire codebase.
- Use edit-style responses (show what changed) for small modifications.
- For new files, show complete content.
- Do not repeat unchanged code blocks.
- Do not explain patterns already documented in `docs/`.
- Reference `docs/` files instead of re-explaining architecture.

## How Claude Should Respond

1. Read relevant files before modifying them.
2. Follow existing patterns in the codebase.
3. Place files in the correct layer per the architecture rules.
4. Use existing utilities (`backendFetch`, `Button`, `ROUTES`, `env`).
5. Validate API responses with Zod.
6. Map DTOs to UI models.
7. Export from `index.ts` barrel files.
8. Add new routes to `ROUTES` and relevant path arrays in `routes.ts`.
9. Keep responses focused on what was asked.

## How To Add a New Module

```
src/modules/<domain>/
├── api/<domain>.api.ts       # backendFetch calls, returns UI models
├── model/types.ts            # DTO + UI model interfaces
├── model/schema.ts           # Zod schemas for DTO validation
├── ui/<Component>.tsx        # Domain-specific React components
├── lib/map<Entity>.ts        # DTO → UI model mapper
└── index.ts                  # Public exports only
```

Steps:
1. Create the directory structure above.
2. Define DTO (snake_case) and UI model (camelCase) types.
3. Create Zod schema matching the DTO.
4. Create mapper function.
5. Create API functions using `backendFetch` with `accessToken` parameter.
6. Create UI components receiving data as props.
7. Export public API from `index.ts`.

## How To Add a New Protected Route

1. Create `src/app/(protected)/<route>/page.tsx`.
2. Add the path string to `PROTECTED_PATHS` in `src/shared/config/routes.ts`.
3. Add a named key to the `ROUTES` object.
4. Add navigation entry in `widgets/Sidebar/Sidebar.tsx` if needed.
5. The existing `(protected)/layout.tsx` handles auth and PageShell automatically.

## How To Add a New Public Route

1. Create `src/app/(public)/<route>/page.tsx`.
2. Add to `ROUTES` object if navigation links are needed.

## How To Add a New Auth Route

1. Create `src/app/(auth)/<route>/page.tsx`.
2. Add the path to `AUTH_ROUTES` in `src/shared/config/routes.ts`.
3. Add to `ROUTES` object.

## Commands

```bash
npm run dev       # Start development server
npm run build     # Production build (includes type checking)
npm run lint      # ESLint
npm start         # Start production server
```
