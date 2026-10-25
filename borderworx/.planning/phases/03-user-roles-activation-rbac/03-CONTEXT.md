# Phase 03: User & Roles — Activation Lifecycle + RBAC Gating - Context

**Gathered:** 2026-06-26
**Status:** Ready for planning
**Source:** Interactive decisions (roadmap re-seeded; prior .planning tree was deleted)

<domain>
## Phase Boundary

**In scope:**
- Backend: a self-activation path that flips the authenticated invited user `pending → active`,
  triggered by the frontend after a successful password set.
- Backend: make role mandatory when creating/inviting a user.
- Backend: a current-user endpoint exposing status + permissionKeys for FE gating.
- Frontend: call activation on set-password success; require role in the create-user form;
  gate sidebar nav + table/row actions by permission; graceful pending / no-access states.

**Out of scope (defer):**
- Supabase Auth webhooks / server-side confirmation hooks (we chose the set-password-success path).
- Activate-on-first-login behavior.
- Editing the permission catalog or role→permission seed data.
- A superadmin bootstrap/seed flow (note as a follow-up if no active admin exists).
- Self-service password reset beyond the existing recovery flow.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Activation mechanism — "On set-password success"
- Add a backend endpoint that activates the **currently authenticated** user:
  `POST /auth/activate` (or `/users/me/activate`).
- **CRITICAL:** This endpoint must be guarded by `authMiddleware` ONLY (JWT → `req.userId`),
  **NOT** `requirePermission`/`requireWarehouseScope` — those throw `ForbiddenError('Account pending')`
  for any non-active user, which would make a pending user unable to ever activate. It is a
  chicken-and-egg trap; the activation route must bypass the status gate.
- Behavior: load the user by `supabaseId === req.userId`; if `status === 'pending'`, set
  `status = 'active'` and set `lastLoginAt = now()`. Idempotent: if already active, return 200 no-op.
  Do not allow it to reactivate `suspended`/`inactive` users (only `pending → active`).
- New use-case: `ActivateUserUseCase` in `src/application/use-cases/user/`, wired in `container.ts`,
  exposed via a new route + controller method. Reuse the existing `UserRepository.update`.
- Frontend: in `src/app/(auth)/set-password/page.tsx`, after
  `supabase.auth.updateUser({ password })` succeeds and before redirecting to dashboard, call the
  activation endpoint (with the fresh access token). Handle failure gracefully (still redirect, but
  the next protected call will surface pending — acceptable fallback).

### Role assignment — "Require role at invite"
- Make `roleId` **required** in `CreateUserDto` (`src/application/dto/user.dto.ts`) — change from
  optional to required, with a clear validation error if missing.
- `create-user.use-case.ts` already passes `roleId` through — no logic change beyond the DTO making
  it mandatory.
- Frontend create-user form must include a **required** role `<select>` populated from the roles list
  (reuse the existing roles API/listRoles). Submit is blocked until a role is chosen.
- Note: this does not retroactively assign roles to existing role-less users — that is an admin task
  via the existing edit flow; flag in plan as a manual data note, not code.

### Frontend gating — "Full permission gating"
- Add a current-user endpoint on the backend: `GET /auth/me` (auth-only middleware, must work for
  `active` users; for `pending` users it should still return status so the FE can show the pending
  screen — so it is auth-only, not permission-gated). Returns at least:
  `{ userId, email, firstName, lastName, status, userType, role, permissionKeys, warehouseIds }`.
  Reuse `PrismaAuthContextRepository.loadByUserId` (it already flattens permissionKeys) — but note
  that loader currently has no status gate, so it works for pending users; confirm and reuse.
- Frontend: fetch the current user once (React Query / context provider) and expose a
  `usePermissions()` / `can(key)` helper mirroring backend `makePermissionChecker`
  (`system.all` bypasses; otherwise exact key match).
- Gate `src/widgets/Sidebar/Sidebar.tsx` nav sections/items by required permission (e.g. hide the
  Users/Roles admin section unless `users.read` / `roles.read`). Gate per-table create/edit/delete
  actions by the matching permission key.
- Graceful states (REQ-RBAC-06):
  - If current user `status !== 'active'` → show a friendly "Your account is awaiting activation"
    screen instead of letting them hit raw 403s.
  - If a protected fetch returns 403 with a message starting `Account ` or `Missing permission:` →
    surface a friendly no-access message, not the raw error string.

### Backend self-activation route security
- The activation and `/auth/me` routes are the only routes intentionally **outside** the
  `requirePermission` status gate. Document this clearly in the route file so it isn't "fixed" later.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — RBAC core (reuse, don't rebuild)
- `borderworxWMS/prisma/schema.prisma` — `User`, `Role`, `Permission`, `RolePermission`, enums.
- `borderworxWMS/src/application/use-cases/user/create-user.use-case.ts` — sets `status:'pending'` (:36).
- `borderworxWMS/src/application/use-cases/user/update-user.use-case.ts` — existing status update path.
- `borderworxWMS/src/application/dto/user.dto.ts` — `CreateUserDto` (roleId optional → make required), status enum (:15).
- `borderworxWMS/src/interfaces/http/middlewares/auth.middleware.ts` — JWT-only auth (use for new routes).
- `borderworxWMS/src/interfaces/http/middlewares/require-permission.middleware.ts` — throws `Account ${status}` 403.
- `borderworxWMS/src/domain/auth/auth-context.ts` — `AuthContext` shape.
- `borderworxWMS/src/infrastructure/repositories/prisma-auth-context.repository.ts` — `loadByUserId` (reuse for /me).
- `borderworxWMS/src/interfaces/http/routes/user.routes.ts` + `controllers/user.controller.ts` — route/controller patterns.
- `borderworxWMS/src/main/container.ts` — DI wiring (~:583 auth middleware factories).
- `borderworxWMS/src/infrastructure/services/supabase-admin.service.ts` — invite flow.

### Frontend — auth + gating
- `borderworxWMSFrontend/src/app/(auth)/set-password/page.tsx` — call activation here after password set.
- `borderworxWMSFrontend/src/app/(auth)/callback/page.tsx` — invite/recovery redirect.
- `borderworxWMSFrontend/middleware.ts` + `src/shared/config/routes.ts` — route protection.
- `borderworxWMSFrontend/src/app/(protected)/layout.tsx`, `src/services/auth/requireSession.ts` — session gate.
- `borderworxWMSFrontend/src/widgets/Sidebar/Sidebar.tsx` — nav to gate by permission.
- `borderworxWMSFrontend/src/modules/user/ui/UserTable.tsx` — user create/edit form (add required role select).
- `borderworxWMSFrontend/src/modules/role/` — roles list API to populate the role select.
- The shared `backendFetch` / `BackendError.fromResponse` helper — where 403 messages surface.
</canonical_refs>

<specifics>
## Specific Ideas
- Endpoint names: `POST /auth/activate`, `GET /auth/me` (auth-only). Adjust to match existing route conventions if there's a clearer fit (e.g. `/users/me`).
- `can(key)` FE helper must mirror backend: `held.includes('system.all') || held.includes(key)`.
- Keep activation idempotent and restricted to `pending → active` only.
</specifics>

<deferred>
## Deferred Ideas
- Supabase Auth webhook-based activation (more robust, server-side) — not chosen now.
- Activate-on-first-login.
- Superadmin/bootstrap seeding for the first `system.all` user (flag if no active admin exists).
- Backfilling roles for existing role-less users (manual admin task).
</deferred>

---

*Phase: 03-user-roles-activation-rbac*
*Context gathered: 2026-06-26 via interactive decisions*
