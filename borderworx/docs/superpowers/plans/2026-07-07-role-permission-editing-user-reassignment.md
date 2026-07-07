# Role Permission Editing + User Role Reassignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let admins edit an existing role's permissions and reassign a user's role, using the backend's authoritative permission catalog.

**Architecture:** Add one read-only backend endpoint (`GET /api/permissions`) that serves the existing `PERMISSION_CATALOG` grouped by resource. The frontend fetches it into a shared `PermissionSelector` used by both the create-role and a new edit-role form; a new `/roles/[id]/edit` page and a gated Edit action wire it up. User role reassignment adds a role `<select>` to the existing user edit form (backend + API already support it).

**Tech Stack:** Backend — Node/Express/Prisma, Clean Architecture, ESM (`.js` import suffixes), Vitest. Frontend — Next.js 15 App Router, TypeScript strict, TanStack Query, Zod, Tailwind, Vitest.

## Global Constraints

- Backend ESM: every relative import ends in `.js` (even for `.ts` source).
- Backend response envelope: use `sendSuccess(res, data)` from `src/shared/utils/response.js` — never raw `res.json`.
- Backend permission keys are validated only against `src/domain/auth/permission-catalog.ts`; do not invent keys.
- Frontend: no `any`, no `as` on API data, `@/` imports only, all API responses Zod-parsed, all data fetching via TanStack Query + `backendFetch`.
- Frontend routes come from `@/shared/config/routes.ts`; permission gating via `@/shared/auth` (`usePermissions().can(key)` and `<RequirePermission permission=…>`).
- Two repos: **backend** tasks run in `borderworxWMS/`, **frontend** tasks run in `borderworxWMSFrontend/`. Commit within the relevant repo.
- Permission keys used: role edit → `roles.update`; permissions endpoint → `roles.read`; user edit (incl. reassignment) → `users.update` (existing).

---

## Task 1: Backend — `ListPermissionsUseCase` (grouped catalog)

**Files:**
- Create: `borderworxWMS/src/application/dto/permission.dto.ts`
- Create: `borderworxWMS/src/application/use-cases/permission/list-permissions.use-case.ts`
- Test: `borderworxWMS/tests/unit/use-cases/list-permissions.use-case.test.ts`

**Interfaces:**
- Consumes: `PERMISSION_CATALOG` from `src/domain/auth/permission-catalog.js` (`PermissionDef { key, resource, action, description }`).
- Produces: `class ListPermissionsUseCase { execute(): PermissionGroupDto[] }` and types `PermissionGroupDto` / `PermissionEntryDto`.

- [ ] **Step 1: Write the failing test**

Create `borderworxWMS/tests/unit/use-cases/list-permissions.use-case.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

import { ListPermissionsUseCase } from '../../../src/application/use-cases/permission/list-permissions.use-case.js';
import { PERMISSION_CATALOG } from '../../../src/domain/auth/permission-catalog.js';

describe('ListPermissionsUseCase', () => {
  const useCase = new ListPermissionsUseCase();

  it('groups a resource with its friendly label and ordered keys', () => {
    const groups = useCase.execute();
    const orgs = groups.find((g) => g.resource === 'organizations');
    expect(orgs).toBeDefined();
    expect(orgs?.label).toBe('Organizations');
    expect(orgs?.permissions.map((p) => p.key)).toEqual([
      'organizations.read',
      'organizations.create',
      'organizations.update',
      'organizations.delete',
    ]);
  });

  it('excludes system.* wildcard permissions', () => {
    const groups = useCase.execute();
    expect(groups.some((g) => g.resource === 'system')).toBe(false);
    const allKeys = groups.flatMap((g) => g.permissions.map((p) => p.key));
    expect(allKeys).not.toContain('system.all');
    expect(allKeys).not.toContain('system.all-warehouses');
  });

  it('emits every non-system catalog entry exactly once', () => {
    const emitted = useCase
      .execute()
      .flatMap((g) => g.permissions.map((p) => p.key))
      .sort();
    const expected = PERMISSION_CATALOG.filter((p) => p.resource !== 'system')
      .map((p) => p.key)
      .sort();
    expect(emitted).toEqual(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd borderworxWMS && npx vitest run tests/unit/use-cases/list-permissions.use-case.test.ts`
Expected: FAIL — cannot resolve `list-permissions.use-case.js`.

- [ ] **Step 3: Create the DTO types**

Create `borderworxWMS/src/application/dto/permission.dto.ts`:

```ts
export interface PermissionEntryDto {
  key: string;
  action: string;
  description: string;
}

export interface PermissionGroupDto {
  resource: string;
  label: string;
  permissions: PermissionEntryDto[];
}
```

- [ ] **Step 4: Implement the use-case**

Create `borderworxWMS/src/application/use-cases/permission/list-permissions.use-case.ts`:

```ts
import { PERMISSION_CATALOG } from '../../../domain/auth/permission-catalog.js';
import type { PermissionGroupDto } from '../../dto/permission.dto.js';

const RESOURCE_LABELS: Record<string, string> = {
  users: 'Users',
  roles: 'Roles',
  permissions: 'Permissions',
  customers: 'Customers',
  'customer-contacts': 'Customer Contacts',
  organizations: 'Organizations',
  warehouses: 'Warehouses',
  locations: 'Locations',
  items: 'Items',
  inventory: 'Inventory',
  receipts: 'Receipts',
  orders: 'Orders',
  returns: 'Returns',
  purchaseOrders: 'Purchase Orders',
  putaway: 'Putaway',
  uom: 'Units of Measure',
  suppliers: 'Suppliers',
  shippers: 'Shippers',
  audit: 'Audit',
};

export class ListPermissionsUseCase {
  execute(): PermissionGroupDto[] {
    const groups = new Map<string, PermissionGroupDto>();
    for (const def of PERMISSION_CATALOG) {
      if (def.resource === 'system') continue;
      let group = groups.get(def.resource);
      if (!group) {
        group = {
          resource: def.resource,
          label: RESOURCE_LABELS[def.resource] ?? def.resource,
          permissions: [],
        };
        groups.set(def.resource, group);
      }
      group.permissions.push({ key: def.key, action: def.action, description: def.description });
    }
    return [...groups.values()];
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd borderworxWMS && npx vitest run tests/unit/use-cases/list-permissions.use-case.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd borderworxWMS
git add src/application/dto/permission.dto.ts src/application/use-cases/permission/list-permissions.use-case.ts tests/unit/use-cases/list-permissions.use-case.test.ts
git commit -m "feat(permissions): add ListPermissionsUseCase serving grouped catalog"
```

---

## Task 2: Backend — `GET /api/permissions` endpoint (controller, route, wiring)

**Files:**
- Create: `borderworxWMS/src/interfaces/http/controllers/permission.controller.ts`
- Create: `borderworxWMS/src/interfaces/http/routes/permission.routes.ts`
- Modify: `borderworxWMS/src/interfaces/http/routes/router.ts`
- Modify: `borderworxWMS/src/main/container.ts`

**Interfaces:**
- Consumes: `ListPermissionsUseCase` (Task 1); `Middlewares` (`authMiddleware`, `requirePermission`) from `router.js`; `sendSuccess` from `shared/utils/response.js`.
- Produces: `GET /api/permissions` guarded by `roles.read`, returning `sendSuccess(res, PermissionGroupDto[])`.

- [ ] **Step 1: Create the controller**

Create `borderworxWMS/src/interfaces/http/controllers/permission.controller.ts`:

```ts
import type { Request, Response } from 'express';

import type { ListPermissionsUseCase } from '../../../application/use-cases/permission/list-permissions.use-case.js';
import { sendSuccess } from '../../../shared/utils/response.js';

export class PermissionController {
  constructor(private readonly listPermissionsUseCase: ListPermissionsUseCase) {}

  async list(_req: Request, res: Response): Promise<void> {
    const groups = this.listPermissionsUseCase.execute();
    sendSuccess(res, groups);
  }
}
```

- [ ] **Step 2: Create the routes**

Create `borderworxWMS/src/interfaces/http/routes/permission.routes.ts`:

```ts
import { Router } from 'express';

import type { PermissionController } from '../controllers/permission.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import type { Middlewares } from './router.js';

export function createPermissionRoutes(controller: PermissionController, middlewares: Middlewares): Router {
  const { authMiddleware, requirePermission } = middlewares;
  const router = Router();

  router.get(
    '/',
    authMiddleware,
    requirePermission('roles.read'),
    asyncHandler(async (req, res) => {
      await controller.list(req, res);
    }),
  );

  return router;
}
```

- [ ] **Step 3: Register in `router.ts`**

In `borderworxWMS/src/interfaces/http/routes/router.ts`:

1. Add with the other controller type imports:
```ts
import type { PermissionController } from '../controllers/permission.controller.js';
```
2. Add with the other route-factory imports:
```ts
import { createPermissionRoutes } from './permission.routes.js';
```
3. Add to the `Controllers` interface (next to `roleController`):
```ts
  permissionController: PermissionController;
```
4. Mount it inside `createRouter`, directly after the `/roles` line:
```ts
  router.use('/permissions', createPermissionRoutes(controllers.permissionController, middlewares));
```

- [ ] **Step 4: Wire in `container.ts`**

In `borderworxWMS/src/main/container.ts`:

1. Add imports (near the role imports):
```ts
import { ListPermissionsUseCase } from '../application/use-cases/permission/list-permissions.use-case.js';
import { PermissionController } from '../interfaces/http/controllers/permission.controller.js';
```
2. Instantiate the use-case (near the role use-cases block):
```ts
const listPermissionsUseCase = new ListPermissionsUseCase();
```
3. Instantiate the controller (near `roleController`):
```ts
const permissionController = new PermissionController(listPermissionsUseCase);
```
4. Add `permissionController` to the object literal that is passed to `createRouter` / exported as `controllers` (the same object that lists `roleController`):
```ts
  permissionController,
```

- [ ] **Step 5: Verify build + existing tests pass**

Run: `cd borderworxWMS && npm run build && npm test`
Expected: build succeeds (no TS errors), all existing unit tests plus Task 1's tests pass.

- [ ] **Step 6: Commit**

```bash
cd borderworxWMS
git add src/interfaces/http/controllers/permission.controller.ts src/interfaces/http/routes/permission.routes.ts src/interfaces/http/routes/router.ts src/main/container.ts
git commit -m "feat(permissions): expose GET /api/permissions guarded by roles.read"
```

---

## Task 3: Frontend — permission catalog types, schema, API client

**Files:**
- Create: `borderworxWMSFrontend/src/modules/role/model/permissionCatalog.ts`
- Modify: `borderworxWMSFrontend/src/modules/role/model/schema.ts`
- Create: `borderworxWMSFrontend/src/modules/role/api/permission.api.ts`
- Modify: `borderworxWMSFrontend/src/modules/role/index.ts`
- Test: `borderworxWMSFrontend/src/modules/role/__tests__/permission.api.test.ts`

**Interfaces:**
- Consumes: `backendFetch` from `@/services/http/backendClient`.
- Produces: `listPermissionCatalog(accessToken: string): Promise<PermissionGroup[]>`; types `PermissionGroup { resource, label, permissions: PermissionEntry[] }`, `PermissionEntry { key, action, description }`; schema `permissionCatalogResponseSchema`.

- [ ] **Step 1: Write the failing test**

Create `borderworxWMSFrontend/src/modules/role/__tests__/permission.api.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { permissionCatalogResponseSchema } from '../model/schema';

describe('permissionCatalogResponseSchema', () => {
  it('parses a valid grouped catalog response', () => {
    const raw = {
      success: true,
      data: [
        {
          resource: 'organizations',
          label: 'Organizations',
          permissions: [
            { key: 'organizations.read', action: 'read', description: 'read organizations' },
          ],
        },
      ],
    };
    const parsed = permissionCatalogResponseSchema.parse(raw);
    expect(parsed.data[0].permissions[0].key).toBe('organizations.read');
  });

  it('rejects a malformed entry (missing key)', () => {
    const raw = {
      success: true,
      data: [{ resource: 'x', label: 'X', permissions: [{ action: 'read', description: 'd' }] }],
    };
    expect(() => permissionCatalogResponseSchema.parse(raw)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/role/__tests__/permission.api.test.ts`
Expected: FAIL — `permissionCatalogResponseSchema` is not exported.

- [ ] **Step 3: Add the types**

Create `borderworxWMSFrontend/src/modules/role/model/permissionCatalog.ts`:

```ts
export interface PermissionEntry {
  key: string;
  action: string;
  description: string;
}

export interface PermissionGroup {
  resource: string;
  label: string;
  permissions: PermissionEntry[];
}
```

- [ ] **Step 4: Add the schema**

Append to `borderworxWMSFrontend/src/modules/role/model/schema.ts`:

```ts
export const permissionGroupSchema = z.object({
  resource: z.string(),
  label: z.string(),
  permissions: z.array(
    z.object({
      key: z.string(),
      action: z.string(),
      description: z.string(),
    }),
  ),
});

export const permissionCatalogResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(permissionGroupSchema),
});
```

- [ ] **Step 5: Create the API client**

Create `borderworxWMSFrontend/src/modules/role/api/permission.api.ts`:

```ts
import { backendFetch } from '@/services/http/backendClient';
import { permissionCatalogResponseSchema } from '../model/schema';
import type { PermissionGroup } from '../model/permissionCatalog';

export async function listPermissionCatalog(accessToken: string): Promise<PermissionGroup[]> {
  const raw = await backendFetch('/api/permissions', { accessToken });
  const { data } = permissionCatalogResponseSchema.parse(raw);
  return data;
}
```

- [ ] **Step 6: Export from the barrel**

Add to `borderworxWMSFrontend/src/modules/role/index.ts`:

```ts
export { listPermissionCatalog } from './api/permission.api';
export type { PermissionGroup, PermissionEntry } from './model/permissionCatalog';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/role/__tests__/permission.api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 8: Commit**

```bash
cd borderworxWMSFrontend
git add src/modules/role/model/permissionCatalog.ts src/modules/role/model/schema.ts src/modules/role/api/permission.api.ts src/modules/role/index.ts src/modules/role/__tests__/permission.api.test.ts
git commit -m "feat(role): add permission-catalog types, schema, and API client"
```

---

## Task 4: Frontend — shared `PermissionSelector` component

**Files:**
- Create: `borderworxWMSFrontend/src/modules/role/ui/PermissionSelector.tsx`

**Interfaces:**
- Consumes: `listPermissionCatalog` (Task 3); `useQuery`.
- Produces: `<PermissionSelector accessToken={string} value={string[]} onChange={(keys: string[]) => void} />` — a controlled multi-select of permission keys grouped by resource.

- [ ] **Step 1: Create the component**

Create `borderworxWMSFrontend/src/modules/role/ui/PermissionSelector.tsx`:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { listPermissionCatalog } from '../api/permission.api';

interface PermissionSelectorProps {
  accessToken: string;
  value: string[];
  onChange: (keys: string[]) => void;
}

export function PermissionSelector({ accessToken, value, onChange }: PermissionSelectorProps) {
  const { data: groups, isLoading, isError } = useQuery({
    queryKey: ['permission-catalog'],
    queryFn: () => listPermissionCatalog(accessToken),
    staleTime: 5 * 60 * 1000,
  });

  function togglePermission(perm: string) {
    onChange(value.includes(perm) ? value.filter((p) => p !== perm) : [...value, perm]);
  }

  function toggleGroup(groupKeys: string[]) {
    const allSelected = groupKeys.every((p) => value.includes(p));
    onChange(
      allSelected
        ? value.filter((p) => !groupKeys.includes(p))
        : [...new Set([...value, ...groupKeys])],
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Permissions</h2>
          <span className="text-xs text-gray-400">{value.length} selected</span>
        </div>
      </div>

      {isLoading ? (
        <p className="px-6 py-5 text-sm text-gray-400">Loading permissions…</p>
      ) : isError ? (
        <p className="px-6 py-5 text-sm text-red-500">Failed to load permissions.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {(groups ?? []).map((group) => {
            const groupKeys = group.permissions.map((p) => p.key);
            const allSelected = groupKeys.every((p) => value.includes(p));
            const someSelected = groupKeys.some((p) => value.includes(p));
            return (
              <div key={group.resource} className="px-6 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`group-${group.resource}`}
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={() => toggleGroup(groupKeys)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor={`group-${group.resource}`} className="text-sm font-semibold text-gray-700">
                    {group.label}
                  </label>
                </div>
                <div className="ml-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {group.permissions.map((perm) => (
                    <label
                      key={perm.key}
                      title={perm.description}
                      className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 transition-colors hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={value.includes(perm.key)}
                        onChange={() => togglePermission(perm.key)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs text-gray-600">{perm.action}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `cd borderworxWMSFrontend && npx tsc --noEmit`
Expected: no new errors referencing `PermissionSelector.tsx` (the only pre-existing errors are in `src/modules/warehouse/__tests__/warehouse.api.test.ts`).

- [ ] **Step 3: Commit**

```bash
cd borderworxWMSFrontend
git add src/modules/role/ui/PermissionSelector.tsx
git commit -m "feat(role): add shared PermissionSelector driven by the catalog endpoint"
```

---

## Task 5: Frontend — refactor `CreateRoleForm` to use `PermissionSelector`

**Files:**
- Modify: `borderworxWMSFrontend/src/modules/role/ui/CreateRoleForm.tsx`

**Interfaces:**
- Consumes: `PermissionSelector` (Task 4). Removes the hardcoded `PERMISSION_GROUPS` and its inline toggles.

- [ ] **Step 1: Add the import**

At the top of `CreateRoleForm.tsx`, add:
```ts
import { PermissionSelector } from './PermissionSelector';
```

- [ ] **Step 2: Delete the stale catalog + local toggle handlers**

Remove the `PERMISSION_GROUPS` constant (the `const PERMISSION_GROUPS: Record<string, string[]> = { … };` block) and the two functions `togglePermission` and `toggleGroup` inside the component. Keep the `permissions` state (`const [permissions, setPermissions] = useState<string[]>([])`).

- [ ] **Step 3: Replace the inline Permissions card with the component**

Replace the entire `{/* Permissions */}` card `<div>…</div>` (the block starting `<div className="rounded-xl border border-gray-200 bg-white shadow-sm">` that contains the Permissions header and the `Object.entries(PERMISSION_GROUPS)` map) with:

```tsx
          <PermissionSelector accessToken={accessToken} value={permissions} onChange={setPermissions} />
```

- [ ] **Step 4: Verify build**

Run: `cd borderworxWMSFrontend && npm run build`
Expected: build succeeds; the create-role page compiles with no reference to `PERMISSION_GROUPS`.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMSFrontend
git add src/modules/role/ui/CreateRoleForm.tsx
git commit -m "refactor(role): drive CreateRoleForm permissions from PermissionSelector"
```

---

## Task 6: Frontend — `EditRoleForm` + `/roles/[id]/edit` page + route

**Files:**
- Create: `borderworxWMSFrontend/src/modules/role/ui/EditRoleForm.tsx`
- Modify: `borderworxWMSFrontend/src/modules/role/index.ts`
- Modify: `borderworxWMSFrontend/src/shared/config/routes.ts`
- Create: `borderworxWMSFrontend/src/app/(protected)/roles/[id]/edit/page.tsx`

**Interfaces:**
- Consumes: `updateRole`, `getRoleById`, `Role`, `UpdateRoleRequest` (existing role module); `PermissionSelector` (Task 4); `RequirePermission` from `@/shared/auth`; `ROUTES.roleEdit`.
- Produces: `<EditRoleForm role={Role} accessToken={string} />`; `ROUTES.roleEdit(id)`.

- [ ] **Step 1: Add the route constant**

In `borderworxWMSFrontend/src/shared/config/routes.ts`, add to the Admin section of `ROUTES` (next to `roles`/`rolesNew`):
```ts
  roleEdit: (id: string) => `/roles/${id}/edit`,
```
(No `PROTECTED_PATHS` change needed — the middleware already treats sub-paths of `/roles` as protected, as `/roles/[id]`-style dynamic routes elsewhere confirm. Verify in Step 5.)

- [ ] **Step 2: Create `EditRoleForm`**

Create `borderworxWMSFrontend/src/modules/role/ui/EditRoleForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { updateRole } from '../api/role.api';
import { updateRoleSchema } from '../model/schema';
import { PermissionSelector } from './PermissionSelector';
import { ROUTES } from '@/shared/config/routes';
import type { Role, RoleType } from '../model/types';

interface EditRoleFormProps {
  role: Role;
  accessToken: string;
}

type FormValues = {
  name: string;
  description: string;
  roleType: RoleType;
};

export function EditRoleForm({ role, accessToken }: EditRoleFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [values, setValues] = useState<FormValues>({
    name: role.name,
    description: role.description ?? '',
    roleType: role.roleType,
  });
  const [permissions, setPermissions] = useState<string[]>(role.permissionKeys);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  function set(field: keyof FormValues, value: string) {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);

    const payload = {
      name: values.name,
      description: values.description.trim() || null,
      roleType: values.roleType,
      permissionKeys: permissions,
    };
    const result = updateRoleSchema.safeParse(payload);
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FormValues;
        if (!fieldErrors[field]) fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    try {
      await updateRole(role.id, result.data, accessToken);
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      router.push(ROUTES.roles);
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Role</h1>
          <p className="mt-1 text-sm text-gray-500">Update the role&rsquo;s details and permissions</p>
        </div>
        <Link
          href={ROUTES.roles}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to Roles
        </Link>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-5">
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h2 className="text-sm font-semibold text-gray-700">Role Details</h2>
            </div>
            <div className="space-y-4 px-6 py-5">
              <Field label="Role Name" required error={errors.name}>
                <input
                  type="text"
                  value={values.name}
                  onChange={(e) => set('name', e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </Field>
              <Field label="Description" error={errors.description}>
                <textarea
                  value={values.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </Field>
              <Field label="Role Type" error={errors.roleType}>
                <select
                  value={values.roleType}
                  onChange={(e) => set('roleType', e.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="warehouse">Warehouse</option>
                  <option value="customer">Customer</option>
                  <option value="admin">Admin</option>
                </select>
              </Field>
            </div>
          </div>

          <PermissionSelector accessToken={accessToken} value={permissions} onChange={setPermissions} />

          {serverError && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{serverError}</p>
          )}

          <div className="flex items-center justify-end gap-3 rounded-xl border border-gray-200 bg-white px-6 py-4 shadow-sm">
            <Link
              href={ROUTES.roles}
              className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Export `EditRoleForm` from the barrel**

Add to `borderworxWMSFrontend/src/modules/role/index.ts`:
```ts
export { EditRoleForm } from './ui/EditRoleForm';
```

- [ ] **Step 4: Create the edit page**

Create `borderworxWMSFrontend/src/app/(protected)/roles/[id]/edit/page.tsx`:

```tsx
import { getAccessToken } from '@/services/auth/getSession';
import { RequirePermission } from '@/shared/auth';
import { getRoleById, EditRoleForm } from '@/modules/role';

export default async function EditRolePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const accessToken = await getAccessToken();
  const role = await getRoleById(id, accessToken!);
  return (
    <RequirePermission permission="roles.update">
      <EditRoleForm role={role} accessToken={accessToken!} />
    </RequirePermission>
  );
}
```

(If the repo's other dynamic pages type `params` as a plain object rather than a Promise, match that instead — check `src/app/(protected)/receipts/[id]/page.tsx`.)

- [ ] **Step 5: Verify build + protected routing**

Run: `cd borderworxWMSFrontend && npm run build`
Expected: build succeeds; `/roles/[id]/edit` compiles. Confirm the route sits under the `(protected)` group (it does by path), so the existing layout auth guard + the `RequirePermission` wrapper both apply.

- [ ] **Step 6: Commit**

```bash
cd borderworxWMSFrontend
git add src/modules/role/ui/EditRoleForm.tsx src/modules/role/index.ts src/shared/config/routes.ts "src/app/(protected)/roles/[id]/edit/page.tsx"
git commit -m "feat(role): add edit-role page with permission editing"
```

---

## Task 7: Frontend — `RoleTable` Edit action (gated `roles.update`)

**Files:**
- Modify: `borderworxWMSFrontend/src/modules/role/ui/RoleTable.tsx`

**Interfaces:**
- Consumes: `ROUTES.roleEdit` (Task 6); `EditIcon` from `@/shared/ui/TableHelpers`; `useRouter`.

- [ ] **Step 1: Add imports + router**

In `RoleTable.tsx`:
1. Add `useRouter`:
```ts
import { useRouter } from 'next/navigation';
```
2. Add `EditIcon` to the existing `TableHelpers` import so it reads:
```ts
import { EyeIcon, EditIcon, TrashIcon, PlusIcon, StatusBadge } from '@/shared/ui/TableHelpers';
```
3. Inside `RoleTable`, add near the other hooks:
```ts
  const router = useRouter();
```

- [ ] **Step 2: Add the gated Edit action**

Replace the `rowActions` array with:
```tsx
  const rowActions: RowAction<Role>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewItem },
    ...(can('roles.update')
      ? [{ label: 'Edit', icon: <EditIcon />, onClick: (r: Role) => router.push(ROUTES.roleEdit(r.id)) } as RowAction<Role>]
      : []),
    ...(can('roles.delete')
      ? [{ label: 'Delete', icon: <TrashIcon />, onClick: setDeleteItem, variant: 'danger' } as RowAction<Role>]
      : []),
  ];
```

- [ ] **Step 3: Verify build**

Run: `cd borderworxWMSFrontend && npm run build`
Expected: build succeeds.

- [ ] **Step 4: Manual verification**

Start dev (`npm run dev`), open `/roles` as an admin, confirm an Edit (pencil) action appears, navigates to `/roles/<id>/edit`, the form is pre-filled with the role's current permissions, toggling + Save persists (row's permission count updates). As a user without `roles.update`, confirm no Edit action shows.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMSFrontend
git add src/modules/role/ui/RoleTable.tsx
git commit -m "feat(role): add roles.update-gated Edit action to RoleTable"
```

---

## Task 8: Frontend — reassign user role in `UserEditForm`

**Files:**
- Modify: `borderworxWMSFrontend/src/modules/user/ui/UserTable.tsx`

**Interfaces:**
- Consumes: existing `rolesData` query, `Role` type, `updateUser`, `UpdateUserRequest` (already includes `roleId: string | null`).

- [ ] **Step 1: Pass roles into the edit form**

In `UserTable.tsx`, update the `<UserEditForm>` render inside the Edit modal to pass the roles list:
```tsx
          <UserEditForm
            key={editItem.id}
            user={editItem}
            roles={rolesData?.data ?? []}
            onSubmit={handleUpdate}
            onCancel={() => setEditItem(null)}
          />
```

- [ ] **Step 2: Add the `roles` prop + role state to `UserEditForm`**

In the `UserEditForm` function signature (bottom of the file), add the `roles` prop and a `Role` import. Update the destructured props and prop type:
```tsx
function UserEditForm({
  user,
  roles,
  onSubmit,
  onCancel,
}: {
  user: User;
  roles: Role[];
  onSubmit: (data: UpdateUserRequest) => Promise<void>;
  onCancel: () => void;
}) {
  const [userType, setUserType] = useState<UserType>(user.userType);
  const [status, setStatus] = useState<UserStatus>(user.status);
  const [roleId, setRoleId] = useState<string>(user.roleId ?? '');
```
Ensure `Role` is imported at the top of the file (add `Role` to the existing `@/modules/role` import, or `import type { Role } from '@/modules/role';`).

- [ ] **Step 3: Include `roleId` in the submit payload**

In `handleSubmit` inside `UserEditForm`, change the submit call to:
```tsx
      await onSubmit({ userType, status, roleId: roleId || null });
```

- [ ] **Step 4: Add the Role select to the form body**

Directly after the Status `<div>…</div>` field (before the `{serverError && …}` block), add:
```tsx
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">— No role —</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
```

- [ ] **Step 5: Verify build**

Run: `cd borderworxWMSFrontend && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Manual verification**

In `/users` as an admin, edit a user, change the Role select, Save. Confirm the user's Role column reflects the new role (the `['users']` query invalidates and refetches). Reopen edit → the select shows the newly-assigned role.

- [ ] **Step 7: Commit**

```bash
cd borderworxWMSFrontend
git add src/modules/user/ui/UserTable.tsx
git commit -m "feat(user): allow reassigning a user's role from the edit form"
```

---

## Self-Review

**Spec coverage:**
- Backend `GET /api/permissions` grouped catalog, guarded `roles.read` → Tasks 1–2. ✓
- `listPermissionCatalog` API + schema → Task 3. ✓
- Shared `PermissionSelector` → Task 4. ✓
- `CreateRoleForm` refactor (removes stale `PERMISSION_GROUPS`) → Task 5. ✓
- `EditRoleForm` on `/roles/[id]/edit`, prefilled, submits `updateRole` → Task 6. ✓
- `RoleTable` Edit action gated `roles.update` → Task 7. ✓
- User role reassignment in `UserEditForm` → Task 8. ✓
- Testing: `ListPermissionsUseCase` unit test (Task 1), catalog schema test (Task 3). Route integration test intentionally omitted — the repo's route RBAC integration tests are `describe.skip` pending a test DB + JWT helper; the endpoint's logic lives in the unit-tested use-case and the guard reuses the already-tested `requirePermission` middleware. ✓

**Type consistency:** `PermissionGroupDto`/`PermissionEntryDto` (backend) mirror `PermissionGroup`/`PermissionEntry` (frontend); `listPermissionCatalog` returns `PermissionGroup[]`; `PermissionSelector` consumes `value: string[]`/`onChange`; `EditRoleForm` uses `updateRole(id, UpdateRoleRequest)` where `UpdateRoleRequest` already permits `permissionKeys`; `UpdateUserRequest` already permits `roleId: string | null`. ✓

**Placeholder scan:** No TBD/TODO; every code step contains full code. The only non-verbatim instructions (container `controllers` object insertion, dynamic-route `params` typing) point at an exact existing sibling to match. ✓

**Open checks from spec resolved:** `Role` already exposes `permissionKeys` (prefill from row/`getRoleById`); `UpdateRoleRequest` accepts `permissionKeys`; `/roles` protected sub-path routing confirmed by existing dynamic pages.
