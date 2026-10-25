---
phase: 03-user-roles-activation-rbac
verified: 2026-06-26T00:00:00Z
status: passed
score: 7/7 must-haves verified
overrides_applied: 0
---

# Phase 03: User & Roles — Activation Lifecycle + RBAC Gating — Verification Report

**Phase Goal:** Invited user becomes active on set-password; every user is created with a role; an
active+role user can load WMS tables (no "Account pending"); the frontend gates nav/actions by
permission and shows graceful states instead of raw 403 — while preserving existing RBAC enforcement.

**Verified:** 2026-06-26
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths / Requirements

| Req | Truth | Status | Evidence (file:line) |
| --- | ----- | ------ | -------------------- |
| RBAC-01 | POST /api/auth/activate exists, auth-only, idempotent, pending→active only, writes lastLoginAt | ✓ VERIFIED | `auth.routes.ts:16-22` (authMiddleware only); `activate-user.use-case.ts:15-25` (idempotent, `status !== 'pending'` returns no-op, sets `status:'active'` + `lastLoginAt:new Date()`); `prisma-user.repository.ts:81,84` persists both |
| RBAC-04 | GET /api/auth/me exists, auth-only, returns status + permissionKeys, works for pending | ✓ VERIFIED | `auth.routes.ts:24-30`; `get-current-user.use-case.ts:30-49` (no status gate, returns status+permissionKeys); loader `prisma-auth-context.repository.ts:9-30` has no status gate |
| RBAC-02 | Set-password page calls activation after updateUser, before redirect, graceful failure | ✓ VERIFIED | `set-password/page.tsx:42` updateUser → `:56` activateCurrentUser inside `:53-60` try/catch → `:62` router.replace(dashboard); `activation.api.ts` POSTs `/api/auth/activate` with accessToken |
| RBAC-03 | createUserSchema roleId required (no .optional/.nullable); FE form required role select from listRoles | ✓ VERIFIED | Backend `user.dto.ts:8` `roleId: z.string({required_error}).uuid()`; FE `CreateUserForm.tsx:158-168` required `<select>` from `listRoles` (`:61-63`); schema `model/schema.ts:43` required uuid |
| RBAC-05 | can() mirrors backend (system.all bypass); Sidebar + UserTable/RoleTable gated | ✓ VERIFIED | `CurrentUserContext.tsx:29-30` `keys.includes('system.all') || keys.includes(key)`; Sidebar `:69-70,156-160` filters by requiredPermission; UserTable `:124-130,139` (users.update/delete/create); RoleTable `:135,153` (roles.delete/create) |
| RBAC-06 | Non-active users see AccountStatusScreen; 403 Account*/Missing permission: mapped to friendly text | ✓ VERIFIED | `(protected)/layout.tsx:27-28` renders `AccountStatusScreen` when `status !== 'active'`; `accessErrorMessage.ts` maps `Account ` and `Missing permission:`; used in UserTable `:132` and RoleTable `:140` |
| Regression | Existing requirePermission / requireWarehouseScope enforcement unchanged | ✓ VERIFIED | `git diff --stat main...HEAD`: only new auth files + 1-line DTO change + 4-line router.ts addition; no route file using requirePermission/requireWarehouseScope modified |

**Score:** 7/7 verified

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| app.ts:40 → router.ts:101 → auth.routes.ts | /api/auth/activate, /api/auth/me | Express mount `/api` + `/auth` + `/activate` `/me` | ✓ WIRED |
| set-password/page.tsx | /api/auth/activate | activateCurrentUser(session.access_token) | ✓ WIRED |
| (protected)/layout.tsx | /api/auth/me | getCurrentUser → CurrentUserProvider | ✓ WIRED |
| Sidebar / UserTable / RoleTable | usePermissions().can | conditional render | ✓ WIRED |
| container.ts:591-599 | AuthController | ActivateUserUseCase + GetCurrentUserUseCase wired into controllers | ✓ WIRED |

### Build / Typecheck

| Check | Result | Status |
| ----- | ------ | ------ |
| Backend `npx tsc --noEmit` | exit 0 | ✓ PASS |
| Frontend `npx tsc --noEmit` | 4 errors, all in `warehouse.api.test.ts` (known pre-existing), 0 new | ✓ PASS |
| Frontend `npm run build` | observed green (per phase notes) | ✓ PASS (reported) |

### Anti-Patterns Found

None blocking. The two auth-only routes are intentionally outside the permission gate, documented
with an explicit SECURITY comment in `auth.routes.ts:1-5` to prevent accidental "fixing".

### Notes / Recommended Smoke Test (non-blocking)

- End-to-end runtime path (invite → set-password → activate → load tables) is fully wired and
  type-checks; a one-time manual smoke test against a live invited user is recommended but the
  static evidence for every link is complete.
- RoleTable exposes only Create + Delete actions (both gated); there is no role-edit row action to
  gate. Not a gap.
- Pre-existing role-less users are not backfilled (explicitly deferred in CONTEXT, manual admin task).

### Gaps Summary

No gaps. All six requirements (RBAC-01..06) and the regression check are satisfied in committed code.

---

_Verified: 2026-06-26_
_Verifier: Claude (gsd-verifier)_
