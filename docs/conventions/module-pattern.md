# Module Pattern

## Purpose

Define the standard structure for domain modules and the rules governing their implementation.

## Structure

Every module follows this layout:

```
modules/<domain>/
├── api/
│   └── <domain>.api.ts        Backend API functions
├── model/
│   ├── types.ts               TypeScript interfaces (DTO + UI model)
│   └── schema.ts              Zod validation schemas
├── ui/
│   └── <Component>.tsx        Domain-specific React components
├── lib/
│   └── <utility>.ts           Domain utilities (mappers, validators, helpers)
└── index.ts                   Public API (barrel export)
```

## Subdirectory Responsibilities

### `api/`
- Functions that call the backend via `backendFetch`.
- Each function accepts an `accessToken` parameter for authentication.
- Returns validated, mapped UI models (not raw DTOs).

### `model/`
- `types.ts` — DTO interfaces (snake_case, matching backend) and UI model interfaces (camelCase).
- `schema.ts` — Zod schemas that validate DTO shapes at runtime.

### `ui/`
- React components specific to this domain.
- Components receive data as props. They do not call API functions directly (exception: auth forms that interact with Supabase).
- Mark as `'use client'` only when interactivity is required.

### `lib/`
- Mapper functions: `DTO → UI model`.
- Domain-specific utilities: permission checks, formatters, validators.

### `index.ts`
- Barrel file exporting the module's public API.
- Only entities intended for external use are exported.
- Internal implementation details stay un-exported.

## Example: User Module

```typescript
// modules/user/model/types.ts
interface UserDTO { id: string; full_name: string | null; ... }
interface User { id: string; fullName: string | null; ... }

// modules/user/model/schema.ts
const userDTOSchema = z.object({ id: z.string(), full_name: z.string().nullable(), ... });

// modules/user/lib/mapUser.ts
function mapUser(dto: UserDTO): User { ... }

// modules/user/api/user.api.ts
async function getMe(accessToken: string): Promise<User> {
  const data = await backendFetch('/users/me', { accessToken });
  const dto = userDTOSchema.parse(data);
  return mapUser(dto);
}

// modules/user/index.ts
export { getMe } from './api/user.api';
export { UserCard } from './ui/UserCard';
export type { User, UserDTO } from './model/types';
```

## Rules

1. **Modules never import from other modules.** Shared types go in `shared/`.
2. **Modules always use `backendFetch`** for backend communication. No raw `fetch`.
3. **Modules never access Supabase directly** (except `auth` module for login/signup flows).
4. **All backend responses are Zod-validated** before use.
5. **DTOs are mapped to UI models.** Components never receive DTOs.
6. **`index.ts` is the only entry point.** External code imports from `@/modules/<domain>`, not from internal paths.

## Creating a New Module

1. Create `src/modules/<domain>/` with subdirectories: `api/`, `model/`, `ui/`, `lib/`.
2. Define DTO and UI model types in `model/types.ts`.
3. Create Zod schemas in `model/schema.ts`.
4. Create mapper in `lib/map<Entity>.ts`.
5. Create API functions in `api/<domain>.api.ts`.
6. Create UI components in `ui/`.
7. Create `index.ts` with public exports.

## Scaling

This pattern supports:
- **Multiple entities per module** — add more types, schemas, mappers.
- **Multiple API endpoints** — add more functions to the API layer.
- **Multiple UI components** — add more files to `ui/`.
- **Team ownership** — each module can be owned by a different team or developer.
