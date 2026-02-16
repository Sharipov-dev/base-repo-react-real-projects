# Backend Integration

## Purpose

Document how the frontend communicates with the custom backend API, including authentication, error handling, and response validation.

## Architecture

```
Module API layer
    │
    ▼
backendFetch<T>(path, options)     ← services/http/backendClient.ts
    │
    ├── buildAuthHeaders(token)    ← services/http/headers.ts
    ├── fetch(url, ...)
    └── BackendError.fromResponse  ← services/http/errors.ts
```

## `backendFetch<T>`

Central fetch wrapper in `services/http/backendClient.ts`.

```typescript
export async function backendFetch<T>(
  path: string,
  options: BackendFetchOptions = {},
): Promise<T>
```

**Responsibilities:**
- Prepends `NEXT_PUBLIC_BACKEND_URL` to the path.
- Sets `Content-Type: application/json`.
- Attaches `Authorization: Bearer <token>` if `accessToken` is provided.
- Serializes `body` to JSON.
- Throws `BackendError` on non-2xx responses.
- Returns parsed JSON response typed as `T`.

**Server-side usage:**
```typescript
const token = await getAccessToken();
const data = await backendFetch<UserDTO>('/users/me', { accessToken: token });
```

**Client-side usage:**
```typescript
const supabase = createClient();
const { data: { session } } = await supabase.auth.getSession();
const data = await backendFetch<UserDTO>('/users/me', {
  accessToken: session?.access_token,
});
```

## Authorization Headers

`services/http/headers.ts` exports `buildAuthHeaders(accessToken)`:
- Returns `{ Authorization: 'Bearer <token>' }` if token exists.
- Returns `{}` if token is null.

This is called internally by `backendFetch`. Module code does not build headers manually.

## Error Normalization

`services/http/errors.ts` exports `BackendError`:

```typescript
class BackendError extends Error {
  status: number;
  message: string;
  details?: unknown;
}
```

`BackendError.fromResponse(response)`:
1. Attempts to parse response body as JSON.
2. Extracts `message` field if present.
3. Falls back to `Backend error: <status>`.
4. Preserves full response body as `details` for debugging.

All backend errors are normalized into this class. Module code catches `BackendError` specifically.

## DTO Validation

Backend responses are validated using Zod schemas before mapping to UI models.

Example flow in `modules/user/api/user.api.ts`:

```typescript
export async function getMe(accessToken: string): Promise<User> {
  const data = await backendFetch('/users/me', { accessToken });
  const dto = userDTOSchema.parse(data);   // Zod validates shape
  return mapUser(dto);                       // DTO → UI model
}
```

**Why validate?**
- Backend contract changes are caught immediately at the client boundary.
- Runtime type safety beyond TypeScript's compile-time checks.
- Clear error messages when the API contract drifts.

## DTO → UI Model Mapping

Each module defines a mapper function (e.g., `mapUser`) that transforms snake_case DTOs into camelCase UI models:

```typescript
// DTO from backend (snake_case)
{ id, email, full_name, avatar_url, created_at, updated_at }

// UI model (camelCase, typed dates)
{ id, email, fullName, avatarUrl, createdAt: Date, updatedAt: Date }
```

This separation means:
- UI code never handles snake_case.
- Backend DTO format changes are absorbed in the mapper.
- Date parsing happens in one place.

## Adding a New Backend Endpoint

1. Define the DTO type in `modules/<domain>/model/types.ts`.
2. Create a Zod schema in `modules/<domain>/model/schema.ts`.
3. Create a mapper in `modules/<domain>/lib/map<Entity>.ts`.
4. Create the API function in `modules/<domain>/api/<domain>.api.ts`.
5. Use `backendFetch` with the appropriate path and access token.
6. Export from `modules/<domain>/index.ts`.

## Scaling

- New backend endpoints → new module API functions. No changes to infrastructure.
- Backend URL changes → single `NEXT_PUBLIC_BACKEND_URL` env var update.
- Error format changes → single `BackendError.fromResponse` update.
- Auth mechanism changes → single `buildAuthHeaders` update.
