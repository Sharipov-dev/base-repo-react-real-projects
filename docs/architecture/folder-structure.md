# Folder Structure

## Purpose

Define placement rules for every file in the project. Prevent structural drift as the codebase grows.

## Top-Level Layout

```
/
├── docs/                  Documentation
├── middleware.ts           Next.js edge middleware (root-level, required by Next.js)
├── src/
│   ├── app/               Routing layer
│   ├── modules/           Domain modules
│   ├── services/          Infrastructure services
│   ├── shared/            Cross-cutting utilities
│   └── widgets/           Layout composition blocks
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
└── package.json
```

## `src/app/`

Next.js App Router pages, layouts, and API route handlers.

```
app/
├── layout.tsx             Root layout (html, body, providers)
├── globals.css            Global styles and Tailwind directives
├── providers.tsx          Client-side providers (React Query)
├── (public)/              Public pages (no auth required)
│   ├── page.tsx           Landing page (/)
│   └── pricing/page.tsx   Pricing page (/pricing)
├── (auth)/                Auth pages (redirect if already logged in)
│   ├── login/page.tsx
│   ├── callback/page.tsx
│   └── reset-password/page.tsx
├── (protected)/           Authenticated pages (redirect to /login if no session)
│   ├── layout.tsx         Session guard + PageShell wrapper
│   ├── dashboard/page.tsx
│   └── settings/page.tsx
└── api/
    ├── health/route.ts
    └── auth/logout/route.ts
```

**What goes here:** Pages, layouts, API route handlers, loading/error boundaries.

**What does NOT go here:** Business logic, API client functions, reusable components, domain types.

## `src/modules/`

Domain-driven modules. Each module is a self-contained business domain.

```
modules/
├── auth/
│   ├── api/               Backend API calls for this domain
│   │   └── auth.backend.api.ts
│   ├── model/             Types, interfaces, enums
│   │   └── types.ts
│   ├── ui/                React components specific to this domain
│   │   └── LoginForm.tsx
│   ├── lib/               Domain utilities (validation, permissions)
│   │   └── roles.ts
│   └── index.ts           Public API (barrel export)
└── user/
    ├── api/
    │   └── user.api.ts
    ├── model/
    │   ├── types.ts
    │   └── schema.ts      Zod schemas for DTO validation
    ├── ui/
    │   └── UserCard.tsx
    ├── lib/
    │   └── mapUser.ts     DTO → UI model mapper
    └── index.ts
```

**What goes here:** Domain API functions, domain types, domain-specific UI, domain utilities.

**What does NOT go here:** Infrastructure clients, generic UI components, route definitions, layout widgets.

### Module Rules

- Every module exposes its public API through `index.ts`.
- Modules import from `@/services/` and `@/shared/` only.
- Modules never import from other modules. Cross-module types belong in `shared/`.
- API functions always go through `backendFetch` from `services/http/backendClient`.

## `src/services/`

Infrastructure layer. Framework and provider integrations.

```
services/
├── supabase/
│   ├── client.ts          Browser Supabase client
│   ├── server.ts          Server Supabase client (RSC, route handlers)
│   ├── middleware.ts       Middleware session refresh helper
│   └── types.ts           Re-exported Supabase types
├── http/
│   ├── backendClient.ts   Typed fetch wrapper for the backend
│   ├── errors.ts          BackendError class
│   └── headers.ts         Authorization header builder
└── auth/
    ├── getSession.ts      Server-side session retrieval
    └── requireSession.ts  Session guard (redirects if no session)
```

**What goes here:** Client initialization, fetch wrappers, error normalization, session helpers, auth guards.

**What does NOT go here:** Business logic, UI components, domain types.

## `src/shared/`

Cross-cutting, domain-agnostic utilities.

```
shared/
├── ui/
│   └── Button/
│       ├── Button.tsx
│       └── index.ts
├── config/
│   ├── env.ts             Zod-validated environment variables
│   └── routes.ts          Route path constants
├── hooks/                 Reusable React hooks
├── lib/                   Utility functions
└── styles/
    └── tokens.css         CSS custom properties
```

**What goes here:** Generic components, constants, environment config, shared hooks, utility functions.

**What does NOT go here:** Domain-specific logic, API calls, Supabase client code, layout widgets.

## `src/widgets/`

Application-level layout composition blocks.

```
widgets/
├── Header/
│   ├── Header.tsx
│   └── index.ts
├── Sidebar/
│   ├── Sidebar.tsx
│   └── index.ts
└── PageShell/
    ├── PageShell.tsx
    └── index.ts
```

**What goes here:** Layout shells, navigation bars, sidebars, footers — composed from shared UI components.

**What does NOT go here:** Business logic, API calls, domain-specific content, page-level components.

## `docs/`

Project documentation. Not deployed with the application.

```
docs/
├── README.md
├── architecture/
├── conventions/
├── decisions/
├── infrastructure/
└── prompts/
```
