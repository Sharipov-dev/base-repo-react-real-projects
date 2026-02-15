# Coding Standards

## Purpose

Define code style, patterns, and practices enforced across the project.

## TypeScript

- **Strict mode enabled.** No `any` unless absolutely necessary and documented.
- **No type assertions on API data.** Use Zod validation instead of `as Type`.
- **Prefer `interface` over `type`** for object shapes. Use `type` for unions and aliases.
- **Export types from `model/types.ts`** within each module.

## React Components

- **Server Components by default.** Only add `'use client'` when the component needs interactivity, hooks, or browser APIs.
- **Props interfaces** defined above the component in the same file, or in `model/types.ts` for shared types.
- **No default exports for components.** Named exports only (except page components, which Next.js requires as default).
- **Components receive data as props.** They do not fetch data or access services directly (exception: client auth in LoginForm).

## Imports

- **Use `@/` path alias** for all imports. Never use relative paths that traverse upward (`../../`).
- **Import order:**
  1. External packages (`react`, `next`, `zod`)
  2. Services (`@/services/`)
  3. Modules (`@/modules/`)
  4. Shared (`@/shared/`)
  5. Widgets (`@/widgets/`)
  6. Relative imports (same module)

## Functions

- **Named function declarations** for React components and exported functions.
- **Arrow functions** for callbacks and inline utilities.
- **Async functions** return `Promise<T>` with explicit return types on module API functions.

## Error Handling

- **Backend errors** are normalized into `BackendError`. Catch this class specifically.
- **Supabase errors** are handled at the call site (login form, session checks).
- **No silent failures.** Either handle the error or let it propagate to an error boundary.

## Styling

- **Tailwind CSS utility classes** for all styling.
- **No inline `style` attributes** unless dynamic values are required.
- **Design tokens** defined in `shared/styles/tokens.css` as CSS custom properties.
- **No CSS Modules** in this project (Tailwind handles component-level styling).

## File Organization

- **One component per file.** Helper functions in the same file are acceptable if small.
- **Barrel exports** via `index.ts` in each module/widget directory.
- **Co-locate tests** next to the file being tested (when tests are added).
