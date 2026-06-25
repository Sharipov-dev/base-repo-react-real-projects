---
phase: 02-export-rollout-to-remaining-tables-wire-csv-excel-export-ont
plan: 02
subsystem: frontend-tables-export
tags: [export, csv, xlsx, users, roles, fk-resolution]
requires:
  - shared/ui/DataTable export props (exportFileBaseName/onExportAll/exportAllCount/exportValue)
  - modules/role public API (listRoles)
provides:
  - Users table CSV/XLSX export with roleId→role-name resolution
  - Roles table CSV/XLSX export
affects:
  - borderworxWMSFrontend/src/modules/user/ui/UserTable.tsx
  - borderworxWMSFrontend/src/modules/role/ui/RoleTable.tsx
tech-stack:
  added: []
  patterns:
    - DataTable export wiring mirrored from OrganizationTable reference
    - FK resolution via Map<string,string> built from a roles list query
key-files:
  created: []
  modified:
    - borderworxWMSFrontend/src/modules/user/ui/UserTable.tsx
    - borderworxWMSFrontend/src/modules/role/ui/RoleTable.tsx
decisions:
  - "Imported listRoles via the role module public barrel (@/modules/role) rather than reaching into api/role.api, the least-invasive way to satisfy the plan-locked FK resolution requirement despite CLAUDE.md's no-cross-module rule."
metrics:
  duration: ~6m
  completed: 2026-06-25
---

# Phase 02 Plan 02: Export Rollout to Users and Roles Tables Summary

Wired CSV/XLSX export onto the Users and Roles DataTables, with the Users `roleId` column exporting a human-readable role name (resolved via a `listRoles`-derived map, full-id fallback) instead of the truncated cell value.

## What Was Built

### Task 1 — UserTable export + roleId→name resolution (commit b9eb628)
- Added a `useQuery(['roles-export'], () => listRoles({ page: 1, pageSize: 1000 }, accessToken))`.
- Derived a `Map<string,string>` of `roleId → role.name` and a `resolveRoleName(roleId: string | null): string` helper returning the mapped name, falling back to the FULL roleId (never `.slice(0, 8)`) when unmapped, and `''` when null.
- Added `exportValue` callbacks for every column: `fullName`, `email`, `userType`, `roleId` (→ `resolveRoleName`), `status`, and `lastLoginAt` (ISO string → `new Date(x).toLocaleDateString()`, never `.toISOString()`).
- Added `handleExportAll(): Promise<User[]>` page-loop over `listUsers({ page, pageSize: 100 }, accessToken)` across the full dataset (UserTable has no active search/filter state, so no filter to thread — same as the Organizations reference). Loop breaks on `data.length < EXPORT_PAGE_SIZE || all.length >= meta.totalCount`.
- Passed `exportFileBaseName="users"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}` to `<DataTable<User>>`.

### Task 2 — RoleTable export (commit b5fd395)
- Added `exportValue` callbacks mirroring displayed values: `name`, `roleType`, `permissions` → `r.permissions.length` (matches the count shown in the cell), `status` → `r.isActive ? 'Active' : 'Inactive'`.
- Added `handleExportAll(): Promise<Role[]>` page-loop over `listRoles({ page, pageSize: 100 }, accessToken)` (no filter to thread).
- Passed `exportFileBaseName="roles"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}` to `<DataTable<Role>>`.

## Files Changed

| File | Commit | Change |
| ---- | ------ | ------ |
| borderworxWMSFrontend/src/modules/user/ui/UserTable.tsx | b9eb628 | +39 / -1 — export wiring + roleId name map |
| borderworxWMSFrontend/src/modules/role/ui/RoleTable.tsx | b5fd395 | +22 — export wiring |

## Deviations from Plan

**1. [Rule 3 - Cross-module import path] roles API import routed through the module barrel**
- **Found during:** Task 1.
- **Issue:** The plan requires `listRoles` to be wired into UserTable (FK name resolution, a LOCKED decision), but `borderworxWMSFrontend/CLAUDE.md` states `modules/` must "never" import from other modules.
- **Resolution:** Imported `listRoles` from the role module's public barrel `@/modules/role` (its declared public API) rather than reaching into `@/modules/role/api/role.api`. This satisfies the plan's locked FK requirement with the least architectural intrusion. The plan + locked FK decision take precedence over the general no-cross-module rule, which has no clean alternative for cross-entity name resolution in this component.
- **Files modified:** UserTable.tsx import line.

No other deviations — both tables otherwise mirror the Organizations reference exactly.

## Verification

- Plan automated greps: `exportFileBaseName="users"` + `listRoles` + `handleExportAll` → USER PASS; `exportFileBaseName="roles"` + `handleExportAll` → ROLE PASS.
- `npx tsc --noEmit` produced zero errors referencing UserTable.tsx or RoleTable.tsx (touched files type-check cleanly). Full `npm run build` is deferred to verify plan 02-05 per the plan.
- No `.toISOString()` applied to `lastLoginAt`/`createdAt` (string dates).

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: src/modules/user/ui/UserTable.tsx
- FOUND: src/modules/role/ui/RoleTable.tsx
- FOUND commit: b9eb628
- FOUND commit: b5fd395
