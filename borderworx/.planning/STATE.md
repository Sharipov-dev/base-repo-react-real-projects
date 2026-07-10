---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Ready to execute
last_updated: "2026-07-10T03:10:57.859Z"
progress:
  total_phases: 3
  completed_phases: 0
  total_plans: 8
  completed_plans: 0
  percent: 0
---

# Project State — BorderworxWMS

**Active milestone:** User & Roles activation (Phase 03)
**Active branch:** feat/partial-receipt (do not switch)

## Architecture (relevant to Phase 03)

- **Backend** `borderworxWMS/` — Express + Prisma, clean architecture
  (`domain/` · `application/` · `infrastructure/` · `interfaces/http/`). DI in `src/main/container.ts`.

- **Frontend** `borderworxWMSFrontend/` — Next.js App Router, `src/modules/<entity>/{model,api,ui}`,
  `src/widgets/`, `src/shared/`, `middleware.ts`. Auth via Supabase.

## RBAC — what already exists (DO NOT rebuild; reuse)

- Prisma models: `User{ status, roleId?, supabaseId }`, `Role`, `Permission`, `RolePermission`.
- Permission catalog/resolver: `src/domain/auth/permission-catalog.ts`, `src/application/auth/permission-resolver.ts`.
- Middleware: `auth.middleware.ts` (JWT only → `req.userId`),
  `require-permission.middleware.ts` (loads `AuthContext`, throws `ForbiddenError('Account ' + status)`
  for non-active, then checks permission key), `require-warehouse-scope.middleware.ts`.

- `AuthContext` loader: `src/infrastructure/repositories/prisma-auth-context.repository.ts`
  (`loadByUserId` queries `where: { supabaseId: userId }`).

- Supabase invite: `src/infrastructure/services/supabase-admin.service.ts` (`inviteUserByEmail`).
- FE invite/set-password: `src/app/(auth)/callback/page.tsx`, `src/app/(auth)/set-password/page.tsx`.

## Known gaps (this phase fixes)

- No `pending → active` transition anywhere. Only manual admin `PATCH /users/:id`.
- `roleId` optional; role-less active users hold zero permissions → 403 on everything.
- FE: no status/role/permission awareness; raw 403 text shown.
- `lastLoginAt` declared but never written.

## Accumulated Context

### Roadmap Evolution

- Phase 4 added: Customer create — capture Primary Contact (name/phone/email) and auto-create a `customer_contacts` record when provided (only if the contact field is filled). Avoids extending the customers table.
- Phase 5 added: Customer Receipts tab — replace the empty "available after the customer is created" placeholder with the receipt configuration form (General Settings + Mobile Receiving/SmartScan) available during create and edit, persisted with the customer.
