# RoadTrack Frontend — Documentation

## Project Overview

RoadTrack is a SaaS application for road infrastructure tracking and management. This repository contains the frontend client built with Next.js App Router.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Auth | Supabase Authentication |
| Backend | Custom REST API (JWT-secured) |
| State | React Query (TanStack Query) |
| Styling | Tailwind CSS |
| Validation | Zod |

## Architectural Principles

1. **Layered separation** — UI, business logic, data access, and infrastructure live in distinct layers.
2. **Domain-driven modules** — Each business domain (auth, user, etc.) is self-contained with its own API, model, UI, and lib.
3. **Single responsibility** — Services handle infrastructure; modules handle domain logic; widgets handle layout composition.
4. **Server-first** — Server Components by default. Client Components only where interactivity is required.
5. **Type safety end-to-end** — Zod validates API responses. TypeScript enforces contracts at compile time.
6. **Backend-agnostic auth** — Supabase handles authentication. The backend receives a forwarded JWT and validates it independently.

## Documentation Map

| Document | Purpose |
|---|---|
| [Architecture Overview](./architecture/overview.md) | System design and layer responsibilities |
| [Folder Structure](./architecture/folder-structure.md) | Directory layout and placement rules |
| [Routing](./architecture/routing.md) | Route groups, URL mapping, middleware |
| [Auth Flow](./architecture/auth-flow.md) | Login, session, middleware, token forwarding |
| [Backend Integration](./architecture/backend-integration.md) | `backendClient`, error handling, DTO validation |
| [Data Flow](./architecture/data-flow.md) | Request/response lifecycle through layers |
| [Environment](./infrastructure/environment.md) | Environment variables and validation |
| [Deployment](./infrastructure/deployment.md) | Build, deploy, and runtime configuration |
| [Middleware](./infrastructure/middleware.md) | Next.js middleware behavior |
| [Coding Standards](./conventions/coding-standards.md) | Code style and patterns |
| [Naming Conventions](./conventions/naming-conventions.md) | File, function, and type naming rules |
| [Module Pattern](./conventions/module-pattern.md) | How to structure a domain module |
| [ADR-001](./decisions/adr-001-architecture.md) | Architecture decision record |
| [ADR-002](./decisions/adr-002-auth-strategy.md) | Authentication strategy decision |
| [Prompts](./prompts/) | LLM prompts used to generate this project |

## Quick Reference

```
src/
  app/          → Routes, layouts, API handlers
  modules/      → Domain logic (auth, user, ...)
  services/     → Infrastructure (supabase, http, auth)
  shared/       → Cross-cutting: UI components, config, hooks
  widgets/      → Composed layout blocks (Header, Sidebar, PageShell)
```
