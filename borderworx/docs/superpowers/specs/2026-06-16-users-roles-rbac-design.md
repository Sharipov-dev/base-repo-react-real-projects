# Users / Profiles / Roles — RBAC + Warehouse Scoping — Design Spec

**Date:** 2026-06-16
**Status:** Draft — awaiting user review
**Module:** Identity & Access Management (BorderWorx WMS)
**Repos:** `borderworxWMS` (backend, Express + Prisma + Postgres + Supabase), `borderworxWMSFrontend` (Next.js 15 + React 19 + React Query + Tailwind)

---

## 1. Problem statement

The user/role module currently has the skeleton of RBAC but **no enforcement**:

- Auth middleware checks only *authentication* (valid Supabase JWT), never *authorization*. Any authenticated user can call any endpoint, including creating/deleting users.
- Roles and permissions exist in the DB but are never checked. `Role.permissions` is a loose `Json` string array.
- Frontend has `hasRole`/`isAdmin` helpers that are **unused**; the sidebar and all screens are shown to everyone.
- `User.roleId` is a dangling FK (no Prisma relation to `Role`).
- No user↔warehouse scoping — critical for a WMS where staff should only see their warehouse(s).
- No audit logging, no real profile/settings screen, no user lifecycle workflows, zero tests.

**Goal:** a production-grade, traditional-WMS-style access-control module: granular permissions, custom roles, warehouse scoping, real enforcement (backend + permission-aware UI), audit logging, profile/password management, and user lifecycle.

## 2. Scope

**In scope**
- Granular permission catalog (code-defined) backed by DB tables (hybrid model).
- Custom roles built from permissions (permission matrix UI).
- Warehouse scoping of users.
- Backend enforcement: permission guard + warehouse-scope guard + status enforcement.
- Permission-aware frontend (hooks, `<Can>`, menu/button gating).
- Audit log for identity/access mutations.
- Profile screen + password change.
- User lifecycle: invite (frontend flow), activate / deactivate / suspend / re-invite.
- Tests for resolvers and enforcement.

**Non-goals (deferred)**
- MFA / 2FA.
- Session management ("log out other sessions").
- Multi-role per user (single role retained).
- Role hierarchy / inheritance.
- User teams / groups.
- Bulk user import / CSV.

## 3. Key decisions (defaults pending confirmation)

- **(a)** One role per user (keep `User.roleId`, add the missing relation). No multi-role.
- **(b)** Cross-warehouse admin access is granted via a special permission `system:all-warehouses`, seeded onto the admin role (not a hard-coded role flag).
- **(c)** No user teams/groups in this iteration.
- **Permission storage:** Variant C (hybrid) — code is the source of truth for *what permissions exist*; DB tables store *which roles have which*.

## 4. Data model changes (Prisma)

New / changed models:

```prisma
model Permission {
  id          String   @id @default(uuid())
  key         String   @unique           // e.g. "inventory:adjust"
  resource    String                      // "inventory"
  action      String                      // "adjust"
  description String?
  isDeprecated Boolean @default(false) @map("is_deprecated")
  createdAt   DateTime @default(now()) @map("created_at")

  rolePermissions RolePermission[]
  @@map("permissions")
}

model RolePermission {           // replaces Role.permissions Json
  roleId       String @map("role_id")
  permissionId String @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserWarehouse {            // scoping for internal users
  userId      String @map("user_id")
  warehouseId String @map("warehouse_id")
  createdAt   DateTime @default(now()) @map("created_at")
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse   Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)
  @@id([userId, warehouseId])
  @@map("user_warehouses")
}

model AuditLog {
  id          String   @id @default(uuid())
  actorUserId String?  @map("actor_user_id")
  action      String                       // "user.create", "role.update", ...
  entityType  String   @map("entity_type") // "User", "Role", ...
  entityId    String?  @map("entity_id")
  before      Json?
  after       Json?
  ip          String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([actorUserId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

Changes to existing models:
- `Role`: remove `permissions Json`; add `rolePermissions RolePermission[]`.
- `User`: add `role Role? @relation(fields: [roleId], references: [id])`; add `warehouses UserWarehouse[]`.
- `Warehouse`: add `userWarehouses UserWarehouse[]`.

**Migration data step:** migrate existing `Role.permissions` JSON arrays into `RolePermission` rows (match keys against seeded `Permission` table; log any unmatched keys) before dropping the column.

## 5. Permission catalog (source of truth — code)

A typed catalog in the backend, format `resource:action`.

- **Resources:** users, roles, permissions, customers, organizations, warehouses, locations, items, inventory, receipts, orders, returns, purchaseOrders, putaway, uom, suppliers, shippers, audit.
- **Standard actions per resource:** `read`, `create`, `update`, `delete` (only those that make sense per resource).
- **Special actions:** `inventory:adjust`, `receipts:process`, `orders:ship`, `returns:process`, `putaway:confirm`, `users:invite`, `roles:assign`, `audit:read`.
- **System permission:** `system:all-warehouses` (cross-warehouse access).

A seed script syncs the catalog into the `Permission` table: inserts new keys, marks removed keys `isDeprecated = true` (never hard-deletes, to preserve audit references).

## 6. Backend enforcement

- `requirePermission(key)` — middleware run after auth. Resolves the user's effective permissions (role → role_permissions → permission keys), returns `403` if `key` is absent. Permission set is resolved once per request and cached on `req`.
- `requireWarehouseScope(getWarehouseId)` — for warehouse-bound resources. Computes the user's allowed warehouse set:
  - `userType = internal` → from `UserWarehouse`.
  - `userType = customer | external` → from `Customer → CustomerWarehouse`.
  - any user holding `system:all-warehouses` → all warehouses (bypass).
  Returns `403` if the resource's `warehouseId` is not in the allowed set.
- **Status enforcement:** auth middleware rejects users whose `status != active` (`pending`/`inactive`/`suspended` → `403`).
- Apply guards declaratively per route.

## 7. Warehouse scoping summary

| User type | Allowed warehouses |
|---|---|
| internal | explicit `UserWarehouse` assignments |
| customer / external | `Customer → CustomerWarehouse` |
| any with `system:all-warehouses` | all |

## 8. Audit logging

- `auditService.log({ actorUserId, action, entityType, entityId, before, after, ip })`.
- Called from identity/access mutation use-cases first (user/role/permission/warehouse-assignment create/update/delete, lifecycle actions, role assignment). Designed to extend to other domains later.
- `GET /audit-logs` — filters (actor, entityType, entityId, date range), pagination, guarded by `audit:read`.

## 9. Profile + password change

- `GET /me` — current user incl. effective permissions and allowed warehouses (drives the frontend permission layer).
- `PATCH /me` — update own profile fields (first/last name, avatar URL, preferences).
- Password change delegated to Supabase (`updateUser`); a thin backend/endpoint wrapper or direct client call (decide in plan).
- Frontend: replace the stub Settings page with a real profile screen (details, change password, avatar).

## 10. User lifecycle

- Invite flow on the frontend (form → existing backend Supabase invite).
- Actions: `activate`, `deactivate`, `suspend`, `re-invite` — endpoints + buttons in the users table. Each writes an audit entry.
- Warehouse assignment UI in the user form (for internal users).

## 11. Frontend (permission-aware UI)

- `usePermissions()` hook + `can(key)` helper + `<Can permission="...">` component, sourced from `/me`.
- Sidebar/menu items and create/edit/delete buttons gated by permissions. (UI gating is UX only — backend remains the source of truth.)
- New/updated screens:
  - Role form with a **permission matrix** (checkboxes by resource × action).
  - User form with **warehouse assignment** + role selection.
  - Real **profile/settings** page.
  - **Invite user** form.
  - Lifecycle actions in the users table.
  - **Audit log** page.

## 12. Testing

Current coverage: none. Add:
- Unit: permission resolver, warehouse-scope resolver.
- Integration: enforcement matrix (403/200 across roles), lifecycle transitions, audit writes.
- (Tooling note: `ruflo-testgen` is installed and can scaffold tests.)

## 13. Implementation phases

- **Phase 1 — Core security:** data model + migrations + permission catalog + seed + `requirePermission` + `requireWarehouseScope` + status enforcement + `User→Role` relation + JSON→RolePermission data migration.
- **Phase 2 — Audit & lifecycle:** AuditLog model + service + `GET /audit-logs`; lifecycle endpoints (activate/deactivate/suspend/re-invite); `/me` endpoints.
- **Phase 3 — Frontend:** permission layer (`usePermissions`/`<Can>`), menu/button gating, permission matrix, warehouse assignment, profile/settings, invite flow, lifecycle actions, audit page.

## 14. Risks & notes

- Both submodules currently have substantial uncommitted work on other feature branches (`feat/wms-phase2`, `feat/table-column-visibility`). Implementation MUST start from a clean tree on a dedicated branch to avoid entangling that work.
- DB migrations are effectively irreversible against a shared DB — generate migration files and apply only against a dev/branch DB with explicit approval; never auto-apply to production.
- Backend is the security source of truth; frontend gating is UX only.
- The existing Supabase invite flow is reused; this spec does not change the auth provider.
