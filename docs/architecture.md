# Architecture

## Overview

The project follows a **feature-sliced** architecture adapted for Next.js App Router. Code is organized into four layers with a strict dependency rule: each layer can only import from layers below it.

```
app  →  features  →  entities  →  shared
```

## Layers

### `src/shared/`

Foundation layer. Zero project-specific business logic.

| Path | Responsibility |
|---|---|
| `api/client/apiClient.client.ts` | Browser fetch wrapper (JSON, errors, abort) |
| `api/client/apiClient.server.ts` | Server fetch wrapper (cookies/auth forwarding) |
| `api/client/errors.ts` | `ApiError`, `NetworkError`, `AbortError` classes |
| `api/client/retry.ts` | `withRetry()` — exponential backoff for 5xx |
| `api/client/cancel.ts` | `createCancelToken()` — AbortController helper |
| `api/mapping/dto.ts` | DTO → domain mappers (`mapUserDTO`, `mapOrderDTO`) |
| `lib/auth/session.server.ts` | `getSession()`, `requireSession()`, `getUser()` via Supabase SSR |
| `lib/auth/tokenStorage.client.ts` | sessionStorage fallback (prefer cookies) |
| `lib/featureFlags/*.ts` | Static feature flags (server + client) |
| `ui/Button/` | Generic Button component (variant, size) |

### `src/entities/`

Domain models. Pure types, no logic.

| Entity | Types |
|---|---|
| `user` | `User` — id, email, fullName, avatarUrl, createdAt |
| `order` | `Order` — id, title, status, totalPrice, currency, createdAt, updatedAt |
|         | `OrderStatus` — `'pending' \| 'in_progress' \| 'completed' \| 'cancelled'` |

### `src/features/`

Business features. Each feature is a self-contained module with a public API exported from `index.ts`.

#### `features/auth`

| File | What it does |
|---|---|
| `ui/LoginForm.tsx` | Email/password form, calls `useAuth().handleLogin` |
| `model/useAuth.ts` | Hook: `handleLogin`, `handleLogout`, `isPending`, `error` |
| `api/auth.client.ts` | `login()`, `logout()`, `getClientSession()` via Supabase browser client |
| `api/auth.server.ts` | Re-exports `getSession`, `requireSession`, `getUser` from shared |
| `types.ts` | `LoginCredentials`, `AuthResponse` |

#### `features/orders`

| File | What it does |
|---|---|
| `ui/OrdersTable.tsx` | Table rendering orders with status badges, uses `useOrdersQuery` |
| `model/useOrdersQuery.ts` | React Query hook wrapping `fetchOrders` |
| `api/orders.client.ts` | `fetchOrders(params)` — browser-side, uses `clientFetch` + retry |
| `api/orders.server.ts` | `fetchOrdersServer()` — server-side, forwards auth |
| `types.ts` | `GetOrdersParams`, `OrdersListResponse` |

### `src/app/`

Next.js routing layer. Pages compose features. No business logic here.

```
app/
  layout.tsx                        # Root layout (font, QueryProvider, CSS)
  providers.tsx                     # "use client" — React Query setup
  page.tsx                          # Redirects to /login
  (public)/
    login/page.tsx                  # Renders LoginForm
  (protected)/
    orders/
      page.tsx                      # Server component — requireSession + OrdersTable
      loading.tsx                   # Skeleton loader
      error.tsx                     # Error boundary with retry
  api/
    upload/route.ts                 # BFF: proxy multipart upload to backend
```

### `src/middleware.ts`

Runs on every request matching the `config.matcher`. Checks Supabase session for protected routes (`/orders`). Refreshes tokens via cookie exchange. Redirects unauthenticated users to `/login?redirect=<original-path>`.

## Data Flow

### Authentication

```
Browser                    Middleware              Supabase
  │                            │                       │
  ├── LoginForm ──────────────────────────────────────►│ signInWithPassword
  │◄──────────────────────────────────────────────────┤ session cookies set
  │                            │                       │
  ├── GET /orders ────────────►│                       │
  │                            ├── getUser() ─────────►│ validate session
  │                            │◄─────────────────────┤ user or null
  │                            │                       │
  │                     [user exists?]                  │
  │                     yes → NextResponse.next()       │
  │                     no  → redirect /login           │
```

### Fetching Orders (client-side with React Query)

```
OrdersTable → useOrdersQuery → fetchOrders → clientFetch → NEXT_PUBLIC_BACKEND_URL/orders
                                                   │
                                              withRetry (5xx)
                                                   │
                                              mapOrderDTO (snake_case → camelCase)
```

### BFF Upload

```
Browser                  /api/upload               Backend
  │                          │                        │
  ├── POST formData ────────►│                        │
  │                          ├── getSession()         │
  │                          ├── Bearer token         │
  │                          ├── POST formData ──────►│ /upload
  │                          │◄──────────────────────┤ response
  │◄─────────────────────────┤ JSON response          │
```

## Error Handling

All API calls normalize errors:

| Error Class | When | Properties |
|---|---|---|
| `ApiError` | HTTP 4xx/5xx response | `status`, `statusText`, `body`, helper getters |
| `NetworkError` | Network failure, DNS, timeout | `message`, `cause` |
| `AbortError` | Request cancelled via AbortController | — |

React Query catches these in `useQuery` and surfaces them via the `error` property. The `error.tsx` boundary catches rendering errors in protected routes.

## Environment

| Variable | Runtime | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase public key |
| `BACKEND_URL` | Server only | Backend API (not leaked to browser) |
| `NEXT_PUBLIC_BACKEND_URL` | Client + Server | Backend API (public) |
