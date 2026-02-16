# Data Flow

## Purpose

Document the request and response lifecycle as data moves through the application layers.

## Request Path

```
UI Component
    │  (user interaction or server render)
    ▼
Module API function          modules/<domain>/api/<domain>.api.ts
    │  (calls backendFetch with path + token)
    ▼
backendFetch<T>()            services/http/backendClient.ts
    │  (builds URL, attaches headers, serializes body)
    ▼
buildAuthHeaders()           services/http/headers.ts
    │  (adds Authorization: Bearer <token>)
    ▼
fetch()                      Native fetch API
    │
    ▼
Custom Backend               External service
```

## Response Path

```
Custom Backend
    │  (returns JSON response)
    ▼
backendFetch<T>()            services/http/backendClient.ts
    │  (checks status, throws BackendError if non-2xx)
    │  (parses JSON)
    ▼
Zod schema.parse()           modules/<domain>/model/schema.ts
    │  (validates DTO shape at runtime)
    ▼
mapEntity()                  modules/<domain>/lib/map<Entity>.ts
    │  (transforms DTO → UI model)
    ▼
Typed UI model               modules/<domain>/model/types.ts
    │
    ▼
UI Component                 Renders the data
```

## Concrete Example: `getMe()`

### Request
```
DashboardPage (server component)
    │
    ▼
requireSession() → getAccessToken()
    │  (extracts access_token from Supabase session via cookies)
    ▼
getMe(accessToken)                     modules/user/api/user.api.ts
    │
    ▼
backendFetch('/users/me', { accessToken })
    │
    ▼
fetch('http://localhost:4000/users/me', {
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer eyJhbG...'
  }
})
```

### Response
```
Backend returns: { id, email, full_name, avatar_url, created_at, updated_at }
    │
    ▼
backendFetch parses JSON → unknown
    │
    ▼
userDTOSchema.parse(data) → UserDTO (validated)
    │
    ▼
mapUser(dto) → User { id, email, fullName, avatarUrl, createdAt: Date, updatedAt: Date }
    │
    ▼
Component renders User data
```

## Error Path

```
Backend returns 4xx/5xx
    │
    ▼
backendFetch detects !response.ok
    │
    ▼
BackendError.fromResponse(response)
    │  (parses body, extracts message)
    ▼
throw BackendError { status, message, details }
    │
    ▼
Caller handles error (try/catch, error boundary, or React Query onError)
```

## Server vs Client Data Flow

### Server Component (RSC)
```
Server render → getAccessToken() from cookies → backendFetch → render HTML
```
Token comes from `services/auth/getSession.ts` which reads cookies via `next/headers`.

### Client Component
```
Browser → supabase.auth.getSession() → backendFetch → update state
```
Token comes from the Supabase browser client which manages cookies in the browser.

## React Query Integration

For client-side data fetching, modules can expose query hooks:

```typescript
// In module api or hooks
function useMe() {
  return useQuery({
    queryKey: ['user', 'me'],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      return getMe(session!.access_token);
    },
  });
}
```

React Query handles caching, refetching, and loading states. The data flow through `backendFetch` remains identical.

## Key Principles

1. **All backend calls go through `backendFetch`.** No raw `fetch()` to the backend anywhere else.
2. **All responses are validated with Zod.** No `as Type` assertions on API data.
3. **All DTOs are mapped to UI models.** Backend format never leaks into components.
4. **Token acquisition is context-dependent.** Server: from cookies. Client: from Supabase browser client.
5. **Errors are normalized.** All backend failures become `BackendError` instances.
