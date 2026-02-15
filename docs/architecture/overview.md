# Architecture Overview

## Purpose

Define the system's layered architecture, separation of concerns, and the rationale behind each structural decision.

## Layered Architecture

```
┌─────────────────────────────────────────┐
│  app/                                   │  Routing, layouts, pages
│  (public) │ (auth) │ (protected)        │  Route groups
├─────────────────────────────────────────┤
│  widgets/                               │  Layout composition
│  Header │ Sidebar │ PageShell           │  (no business logic)
├─────────────────────────────────────────┤
│  modules/                               │  Domain logic
│  auth/ │ user/ │ ...                    │  API, model, UI, lib
├─────────────────────────────────────────┤
│  services/                              │  Infrastructure
│  supabase/ │ http/ │ auth/              │  Clients, guards, helpers
├─────────────────────────────────────────┤
│  shared/                                │  Cross-cutting
│  ui/ │ config/ │ hooks/ │ lib/          │  Reusable, domain-agnostic
└─────────────────────────────────────────┘
```

## Layer Responsibilities

### `app/` — Routing Layer
- Defines URL structure via Next.js App Router file conventions.
- Route groups `(public)`, `(auth)`, `(protected)` enforce access patterns.
- Contains layouts that compose widgets and guard access.
- Pages are thin — they delegate rendering to module UI or widgets.

### `widgets/` — Composition Layer
- Assembles shared layout blocks: Header, Sidebar, PageShell.
- Receives data as props from server layouts.
- Contains no business logic or API calls.
- Widgets are application-specific (not generic like `shared/ui`).

### `modules/` — Domain Layer
- Each module encapsulates one business domain.
- Internal structure: `api/`, `model/`, `ui/`, `lib/`, `index.ts`.
- Modules communicate with the backend exclusively through `services/http/backendClient`.
- Modules never import from other modules directly. Shared types go in `shared/`.

### `services/` — Infrastructure Layer
- `supabase/` — Supabase client creation (browser, server, middleware).
- `http/` — Backend fetch wrapper, error normalization, auth headers.
- `auth/` — Server-side session retrieval and route guards.
- Services are domain-agnostic. They provide capabilities, not business logic.

### `shared/` — Cross-cutting Layer
- `ui/` — Generic UI components (Button, Input, etc.).
- `config/` — Environment validation, route constants.
- `hooks/` — Reusable React hooks.
- `lib/` — Utility functions (formatting, parsing, etc.).

## Why Route Groups

Next.js route groups (`(public)`, `(auth)`, `(protected)`) allow different layouts and access patterns without affecting URL structure:

- `(public)` — No auth required. Landing, pricing.
- `(auth)` — Auth pages (login, reset-password). Redirect to dashboard if already authenticated.
- `(protected)` — Requires valid session. Wraps content in PageShell. Redirects to login if unauthenticated.

## Why Modules

Modules prevent the codebase from becoming a flat collection of files. Each domain owns its types, API layer, UI, and utilities. This scales naturally — adding a new domain means adding a new module directory, not scattering files across the tree.

## Why Services Layer

Separating infrastructure from domain logic means:
- Changing the auth provider (e.g., Supabase → Auth0) affects only `services/supabase/`.
- Changing the backend URL or error format affects only `services/http/`.
- Domain modules remain stable through infrastructure changes.

## Scaling Strategy

- New domain → new `modules/<name>/` directory.
- New route → new page in the appropriate route group.
- New widget → new `widgets/<Name>/` directory.
- New shared component → new `shared/ui/<Name>/` directory.
- New infrastructure concern → new `services/<name>/` directory.

The architecture supports team scaling by providing clear ownership boundaries per module.
