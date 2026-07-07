# Design: Edit Role Permissions + Reassign User Role

**Date:** 2026-07-07
**Repos:** `borderworxWMS` (backend), `borderworxWMSFrontend` (frontend)
**Type:** Feature (mostly frontend; one small backend endpoint)

## Problem

Admins need two capabilities that don't exist in the UI today:

1. **Edit an existing role's permissions** — `RoleTable` only exposes View and Delete; there is no Edit action and no edit form. The permission picker in `CreateRoleForm` is a hardcoded `PERMISSION_GROUPS` list covering only ~7 resources, so even if editing existed it couldn't grant most permissions.
2. **Reassign a user's role after creation** — `UserEditForm` edits only User Type and Status. It has no role selector, so a user's role is effectively set once at creation and can never be changed.

## Current state (verified)

- **Backend already supports both mutations:**
  - `PATCH /api/roles/:id` (guard `roles.update`) with `updateRoleSchema` accepting `permissionKeys` (each validated against `isKnownPermission`).
  - `PATCH /api/users/:id` (guard `users.update`) with `updateUserSchema` accepting `roleId`.
  - `PERMISSION_CATALOG` (`src/domain/auth/permission-catalog.ts`) is the authoritative source of permission keys; a `permissions.read` key already exists in it.
- **Frontend API clients already exist:** `updateRole(id, data, token)` and `updateUser(id, data, token)`.
- **The only missing backend piece** is a way to serve the permission catalog to the frontend (no `GET /api/permissions` endpoint exists today).

So this is a frontend feature plus one small read-only backend endpoint.

## Feature A — Edit a role's permissions

### Backend: `GET /api/permissions`

Serve the authoritative catalog grouped by resource so both role forms build their pickers from it (kills the frontend/backend drift that previously caused a 400 on role creation).

- **Use-case** `ListPermissionsUseCase` (`src/application/use-cases/permission/list-permissions.use-case.ts`): transforms `PERMISSION_CATALOG` into a grouped structure. No repository — the catalog is static domain data.
- **Controller** `PermissionController` (`src/interfaces/http/controllers/permission.controller.ts`): thin, calls the use-case, `sendSuccess`.
- **Routes** `permission.routes.ts`: `GET /` with `authMiddleware` + `requirePermission('roles.read')`. Mounted at `/api/permissions` in the router.
- **Container** wiring: instantiate use-case → controller; export from `controllers`.

**Guard rationale:** `roles.read` (not `permissions.read`) so anyone who can manage roles can load the catalog without a seed/role change. Admins hold `system.all` regardless. `system.all-*` wildcards are excluded from the response (they are not per-resource grantable toggles); the two `system.*` entries are omitted.

**Response shape** (`sendSuccess` envelope, `data` is):
```jsonc
[
  {
    "resource": "organizations",
    "label": "Organizations",
    "permissions": [
      { "key": "organizations.read",   "action": "read",   "description": "read organizations" },
      { "key": "organizations.create", "action": "create", "description": "create organizations" }
    ]
  }
]
```
`label` is a human-friendly title derived from the resource (e.g. `purchaseOrders` → "Purchase Orders", `customer-contacts` → "Customer Contacts"). Resource order follows `PERMISSION_CATALOG` declaration order.

### Frontend

- **API + schema:** `listPermissionCatalog(accessToken)` returning the grouped array, validated by a Zod schema. Location: the role module — `src/modules/role/api/permission.api.ts` with types/schema under `src/modules/role/model/` — since it is used only for role management. Follows the standard `backendFetch` → Zod parse → return pattern.
- **`PermissionSelector` component** (shared, used by both create and edit): fetches the catalog via `useQuery`, renders one group per resource with:
  - a per-group "select all / none" toggle,
  - individual permission checkboxes (label = action, title/tooltip = description),
  - a global "clear all".
  - Props: `value: string[]`, `onChange: (keys: string[]) => void`. Purely controlled; no internal source of truth for selection.
- **`CreateRoleForm` refactor:** replace the hardcoded `PERMISSION_GROUPS` block with `<PermissionSelector value={permissions} onChange={setPermissions} />`. No behavior change beyond the now-complete catalog.
- **`EditRoleForm`** on page **`/roles/[id]/edit`** (mirrors the existing `/roles/new` page; the permission grid needs the space):
  - Loads the role (from `getRoleById` or router state) and pre-fills `name`, `description`, `roleType`, and selected `permissionKeys`.
  - Reuses the shared form fields + `PermissionSelector`.
  - Submits via `updateRole(id, { name, description, roleType, permissionKeys }, token)`.
  - On success, invalidate the roles query and return to `/roles`.
- **`RoleTable`:** add an **Edit** row action, gated `roles.update`, that navigates to `ROUTES.roleEdit(role.id)`. Keep the existing View (always) and Delete (`roles.delete`) actions.
- **Routing:** add `roleEdit: (id: string) => \`/roles/${id}/edit\`` to `ROUTES`; add `/roles` subtree coverage to `PROTECTED_PATHS`. Wrap the edit page body in `<RequirePermission permission="roles.update">`.

**Prefill dependency:** the frontend `Role` model must expose `permissionKeys` (the list response already returns them; `RoleDetailsPanel` renders them). Confirm during implementation; if the list omits them, fetch via `getRoleById` on the edit page.

## Feature B — Reassign a user's role

- Extend the existing `UserEditForm` (inside `UserTable`):
  - Add a **Role `<select>`** populated from `listRoles` (already imported in `UserTable` for name resolution — reuse that query or add one), defaulting to the user's current `roleId`.
  - Include `roleId` in the `updateUser` payload alongside the existing `userType`/`status`.
  - Require a role selection (no empty option) to avoid orphaning a user without a role.
- No new gating: the Edit action is already behind `users.update`.

## Permission gating summary

- Edit-role action + edit page: `roles.update`.
- Permissions catalog endpoint: `roles.read`.
- User edit (incl. role reassignment): `users.update` (existing).

## Testing

- **Backend:**
  - Unit: `ListPermissionsUseCase` returns groups covering every non-`system` catalog entry, correctly grouped and labeled, in declaration order.
  - Integration: `GET /api/permissions` → 200 with expected shape for an authorized user; 403 without `roles.read`.
- **Frontend:**
  - Zod-schema test for the catalog response (accepts valid, rejects malformed).
  - Light test of the edit-role prefill mapping (role → form values incl. selected keys). Matches existing vitest module patterns.

## Out of scope (YAGNI)

- Editing `isActive` on a role (can be added later).
- A dedicated `permissions.read`-guarded catalog or per-role seeding changes.
- Bulk role reassignment across multiple users.
- Warehouse-scope editing (separate Phase 2 concern).

## Open checks for implementation

1. Confirm the frontend `Role` type includes `permissionKeys`; if not, load via `getRoleById` on the edit page.
2. Confirm `updateRole`'s request type accepts `permissionKeys` (it should, mirroring create).
3. Confirm `PROTECTED_PATHS`/middleware already covers dynamic `/roles/[id]/edit` (customers/[id] works, so dynamic protected routes are handled).
