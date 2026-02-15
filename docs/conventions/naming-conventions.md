# Naming Conventions

## Purpose

Enforce consistent naming across the codebase to improve readability and predictability.

## Files and Directories

| Item | Convention | Example |
|---|---|---|
| React components | PascalCase | `LoginForm.tsx`, `UserCard.tsx` |
| Hooks | camelCase with `use` prefix | `useAuth.ts` |
| API functions | camelCase, `<domain>.api.ts` | `user.api.ts`, `auth.backend.api.ts` |
| Utility files | camelCase | `mapUser.ts`, `roles.ts` |
| Type files | camelCase | `types.ts` |
| Schema files | camelCase | `schema.ts` |
| Config files | camelCase | `env.ts`, `routes.ts` |
| Widget directories | PascalCase | `Header/`, `Sidebar/` |
| Module directories | camelCase | `auth/`, `user/` |
| Service directories | camelCase | `supabase/`, `http/` |

## TypeScript

| Item | Convention | Example |
|---|---|---|
| Interfaces | PascalCase | `UserDTO`, `BackendFetchOptions` |
| Types | PascalCase | `AuthRole`, `SessionResult` |
| Enums | PascalCase | `Permission` |
| Constants | UPPER_SNAKE_CASE | `ROUTES`, `AUTH_ROUTES`, `PROTECTED_PATHS` |
| Functions | camelCase | `getMe`, `mapUser`, `buildAuthHeaders` |
| React components | PascalCase | `LoginForm`, `PageShell` |
| Hooks | camelCase with `use` | `useSession` |

## Domain Types

| Item | Convention | Example |
|---|---|---|
| DTO (from backend) | `<Entity>DTO` | `UserDTO` |
| UI model | `<Entity>` | `User` |
| Zod schema | `<entity>DTOSchema` | `userDTOSchema` |
| Mapper function | `map<Entity>` | `mapUser` |
| API function | verb + noun | `getMe`, `syncProfile` |

## Route Constants

Route paths are collected in `ROUTES` object with camelCase keys:

```typescript
ROUTES.dashboard  // '/dashboard'
ROUTES.login      // '/login'
```

## CSS

- **Tailwind classes** follow Tailwind's conventions.
- **CSS custom properties** use kebab-case: `--color-primary`, `--radius-md`.
