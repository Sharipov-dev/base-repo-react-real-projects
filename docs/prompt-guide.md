# Prompt Guide for Developers

How to write effective prompts for Claude when working on this codebase. Copy-paste the templates below, fill in the blanks, and run them in Claude Code.

---

## Principles

1. **Reference the architecture.** Claude reads `CLAUDE.md` automatically. You don't need to re-explain the stack, but mention which layer/feature you're working in.
2. **Be specific about the scope.** "Add a new feature" is vague. "Add a `vehicles` feature with a list page and React Query hook" is actionable.
3. **State the contract.** If you know the backend endpoint shape, paste the request/response JSON. Claude will generate the DTO, mapper, and types from it.
4. **Mention what already exists.** "Follow the same pattern as `features/orders`" saves Claude from guessing.
5. **One task per prompt.** Don't combine "add feature + refactor auth + fix a bug" in one prompt. Chain separate prompts.

---

## Templates

### Add a new feature

```
Create a new feature called `<feature-name>`.

Backend endpoints:
- GET <endpoint> — returns: { items: [...], total: number }
  Item shape: { <field>: <type>, ... }
- POST <endpoint> — body: { ... }, returns: { id: string }

Requirements:
- Domain entity type in `entities/<name>/types.ts`
- DTO mapper in `shared/api/mapping/dto.ts`
- Client API in `features/<name>/api/<name>.client.ts` using `clientFetch` + `withRetry`
- Server API in `features/<name>/api/<name>.server.ts` using `serverFetch`
- React Query hook `use<Name>Query` in `features/<name>/model/`
- UI component `<Name>Table` (or `<Name>List`, `<Name>Card`) in `features/<name>/ui/`
- Protected page at `app/(protected)/<route>/page.tsx` with loading.tsx and error.tsx
- Add the route segment to PROTECTED_SEGMENTS in middleware.ts
- Barrel export in `features/<name>/index.ts`
- Follow the same structure as `features/orders`
```

### Add a new UI component to shared

```
Create a shared UI component `<ComponentName>` in `shared/ui/<ComponentName>/`.

Props:
- <prop>: <type> — <description>
- <prop>: <type> — <description>

Requirements:
- No external UI libraries. Tailwind only.
- Support `className` prop for overrides.
- Export from `shared/ui/<ComponentName>/index.ts`.
- Follow the same pattern as `shared/ui/Button/Button.tsx`.
```

### Add a new BFF API route

```
Create a new BFF endpoint at `app/api/<path>/route.ts`.

Purpose: <what it does and why the client can't call the backend directly>

Backend endpoint: <METHOD> <backend-url>
Request body: <shape or "multipart/form-data">
Response: <shape>

Requirements:
- Check auth with `getSession()` from `shared/lib/auth/session.server.ts`
- Return 401 if no session
- Forward the access token as Bearer header
- Proxy the request to the backend
- Handle errors and return normalized JSON responses
- Follow the same pattern as `app/api/upload/route.ts`
```

### Add a new entity type

```
Add a new domain entity `<EntityName>` in `entities/<name>/`.

Fields:
- <field>: <type>
- <field>: <type>
- <field>: <type>

Backend DTO shape (snake_case):
{ <field>: <type>, ... }

Requirements:
- Types in `entities/<name>/types.ts`
- Barrel export in `entities/<name>/index.ts`
- DTO interface + mapper function in `shared/api/mapping/dto.ts`
```

### Add a new page (protected)

```
Add a protected page at `/(protected)/<route>`.

Requirements:
- Server component page.tsx that calls `requireSession()`
- Renders `<ComponentName>` from `features/<feature>`
- Add loading.tsx with skeleton placeholder
- Add error.tsx with retry button
- Add `'/<route>'` to PROTECTED_SEGMENTS in middleware.ts
```

### Add a new page (public)

```
Add a public page at `/(public)/<route>`.

Requirements:
- Server component page.tsx (no auth check needed)
- Renders: <describe what the page shows>
- No changes to middleware.ts needed
```

### Add a mutation (create/update/delete)

```
Add a mutation for <action> in the `<feature>` feature.

Backend endpoint: <METHOD> <path>
Request body: { ... }
Response: { ... }

Requirements:
- Client API function in `features/<feature>/api/<feature>.client.ts`
- React Query mutation hook `use<Action>Mutation` in `features/<feature>/model/`
  - Invalidate `['<query-key>']` on success
- UI trigger in `features/<feature>/ui/<Component>.tsx`
- Export hook from `features/<feature>/index.ts`
```

### Add form with validation

```
Add a form component `<FormName>` in `features/<feature>/ui/`.

Fields:
- <field> (<type>): <validation rules>
- <field> (<type>): <validation rules>

On submit: call `<apiFunction>` from `features/<feature>/api/`
On success: <redirect / show toast / invalidate query>
On error: show error message inline

Requirements:
- "use client" component
- Controlled form with useState
- Client-side validation before submit
- Disable submit button while pending
- Follow the same pattern as `features/auth/ui/LoginForm.tsx`
```

### Fix a bug

```
Bug: <describe the bug — what happens vs what should happen>

Repro steps:
1. <step>
2. <step>
3. <step>

Suspected area: `<file-path>` or `<feature-name>`

Fix requirements:
- <any constraints on the fix>
- Don't change the public API of the feature
- Add a TODO comment if a deeper refactor is needed later
```

### Refactor / rename

```
Refactor: <describe what you want to change>

Scope: <list files or features affected>

Constraints:
- Keep all existing public APIs working
- Update all imports across the codebase
- Run `npx tsc --noEmit` to verify no type errors after the change
```

---

## Tips for better results

### Paste the backend contract

When you know the API shape, paste it directly:

```
Backend response for GET /vehicles:
{
  "items": [
    {
      "id": "uuid",
      "plate_number": "ABC-123",
      "model": "Toyota Camry",
      "year": 2022,
      "status": "active",
      "created_at": "2025-01-01T00:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20
}
```

Claude will generate the entity type, DTO, mapper, API client, and query hook from this.

### Reference existing patterns

Instead of explaining how things should work, point to code that already works:

- "Follow the same pattern as `features/orders`"
- "Structure it like `shared/ui/Button`"
- "Use the same error handling as `apiClient.client.ts`"

### Verify after generation

Always ask Claude to run the type checker after generating code:

```
After creating the files, run `npx tsc --noEmit` and fix any type errors.
```

### Chain prompts for large features

Break big work into steps:

1. "Create the entity types and DTO mapper for vehicles"
2. "Add the client and server API functions for vehicles"
3. "Add the React Query hook and table component"
4. "Add the protected page with loading and error states"

Each prompt builds on the previous result and stays focused.
