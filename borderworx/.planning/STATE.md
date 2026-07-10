---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 04
last_updated: "2026-07-10T03:59:12.442Z"
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 13
  completed_plans: 2
  percent: 15
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

### Phase 04 Progress

- **04-01 complete** (backend): `createCustomerSchema` accepts optional `primaryContact` (firstName/lastName/email required, phone optional); `PrismaCustomerRepository.create()` wraps customer + primary-contact insert in a single `$transaction` (isPrimary:true, rolls back on failure). `CreateCustomerUseCase`, `customer.controller.ts`, `customer.routes.ts`, `container.ts` unchanged (pass-through DTO). See `.planning/phases/04-customer-create-capture-primary-contact-name-phone-email-and/04-01-SUMMARY.md`.
- Decision: `$transaction` placed in the repository layer (not the use-case), matching the `prisma-receipt.repository.ts` precedent — keeps `CreateCustomerUseCase` a pure pass-through and `CustomerMapper` confined to infrastructure.
- **04-02 complete** (frontend): `CreateCustomerRequest`/`createCustomerSchema` mirror the backend's optional `primaryContact` (firstName/lastName/email required, phone optional). `CreateCustomerForm.tsx` basics tab now has a Primary Contact section (First/Last/Phone/Email); `toRequest()` sends `primaryContact` only when any contact field is filled (`hasAnyContact` guard); nested zod errors map to `contact*` field keys. `updateCustomerSchema`/edit form unchanged (create-only, D-08). See `.planning/phases/04-customer-create-capture-primary-contact-name-phone-email-and/04-02-SUMMARY.md`. Phase 04 is now fully implemented end-to-end.
- Decision: contact email field is fully independent state, never seeded from the company email field (D-04); `primaryContact` is omitted entirely from the request when all four contact fields are empty (D-05).
