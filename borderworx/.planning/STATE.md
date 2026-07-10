---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Executing Phase 05
last_updated: "2026-07-10T13:30:55.235Z"
progress:
  total_phases: 3
  completed_phases: 2
  total_plans: 13
  completed_plans: 7
  percent: 54
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

### Phase 05 Progress

- **05-01 complete** (backend persistence layer): `CustomerReceiptConfig` Prisma model added (1:1 with `Customer`, `customerId @unique`, `onDelete: Cascade`, `@@map("customer_receipt_configs")`), schema pushed to the DB and Prisma client regenerated (`prisma.customerReceiptConfig` delegate confirmed present). Domain entity (`ReceiptConfig`/`UpsertReceiptConfigData`), Zod DTOs (`upsertReceiptConfigSchema`/`receiptConfigParamSchema`/`ReceiptConfigResponseDto`), `ReceiptConfigRepository` interface, `PrismaReceiptConfigRepository` + `ReceiptConfigMapper`, and `GetReceiptConfigUseCase`/`UpsertReceiptConfigUseCase` created, mirroring `CustomerPackingSlipConfig` exactly (D-05). See `.planning/phases/05-customer-receipts-tab-replace-the-empty-available-after-the-/05-01-SUMMARY.md`.
- Decision: `fuelSurchargePercentage` stored as `Decimal(5,2) @default(0)`, converted to `number` via `.toNumber()` in the mapper (D-03).
- Decision: `GetReceiptConfigUseCase` always returns a fully-defaulted `ReceiptConfig` (never `null`) when no row exists yet, so reads never 404 (D-06).
- Next: Plan 02 (HTTP layer — controller/routes/`container.ts` wiring) and Plan 03 (atomic create-time persistence in `CreateCustomerUseCase`) build directly on this persistence layer.
- **05-02 complete** (backend HTTP layer): `ReceiptConfigController` (get/upsert + `toReceiptConfigResponse` shaper) and `createReceiptConfigRoutes` created mirroring `packing-slip-config` exactly; mounted at `/customers/:customerId/receipt-config` in `router.ts` (permission-gated `customers.read`/`customers.update`); `container.ts` wired with `PrismaReceiptConfigRepository`, use-cases, and `receiptConfigController` export. Backend build green. See `.planning/phases/05-customer-receipts-tab-replace-the-empty-available-after-the-/05-02-SUMMARY.md`.
- Decision: `get()` calls `toReceiptConfigResponse(config)` directly with no null branch, since `GetReceiptConfigUseCase` always returns a defaulted `ReceiptConfig` (D-06) — unlike packing-slip-config's nullable get.
- **05-03 complete** (backend atomic create-time persistence): `createCustomerSchema`/`CreateCustomerData` gained an optional `receiptConfig` field (D-06); `PrismaCustomerRepository.create()` extends the existing Phase-4 `$transaction` with a conditional `tx.customerReceiptConfig.create` alongside the existing conditional `tx.customerContact.create` — customer + primary contact + receipt config all roll back together on any failure. `CreateCustomerUseCase`/`customer.controller.ts` untouched (pass-through precedent preserved). Backend build green. See `.planning/phases/05-customer-receipts-tab-replace-the-empty-available-after-the-/05-03-SUMMARY.md`.
- Decision: receipt-config create-field defaults (`?? false` / `?? 0`) mirror `PrismaReceiptConfigRepository.upsert`'s create branch exactly.
- **05-04 complete** (frontend data layer + shared form): `ReceiptConfigDTO`/`ReceiptConfig`/`ReceiptConfigRequest`/`ReceiptConfigFormValues` types + `receiptConfigDTOSchema`/`receiptConfigRequestSchema` Zod schemas added to `customer/model/{types,schema}.ts` (fuel surcharge 0-100, 2dp); `mapReceiptConfig` mapper; `emptyReceiptConfigValues`/`receiptConfigToFormValues`/`receiptFormValuesToRequest` form helpers; `getReceiptConfig`/`upsertReceiptConfig` API calls hitting the Plan 02 HTTP endpoints; shared, presentational `ReceiptSettingsForm` component (values + onChange props, no local state) rendering GENERAL SETTINGS + MOBILE RECEIVING (SMARTSCAN) groups per the screenshot, exported via the module barrel. Frontend typechecks (only pre-existing `warehouse.api.test.ts` errors remain). See `.planning/phases/05-customer-receipts-tab-replace-the-empty-available-after-the-/05-04-SUMMARY.md`.
- Decision: `updateCustomerSchema` omits `receiptConfig` (edit-path persists via the dedicated `upsertReceiptConfig` endpoint, not the customer `PATCH` body).
- **05-05 complete** (both customer UI surfaces wired, Phase 05 now fully implemented end-to-end): `CreateCustomerForm.tsx` Receipts tab renders the shared `ReceiptSettingsForm` (placeholder removed); `toRequest(values, receiptValues)` always includes `receiptConfig` in the create payload so it persists atomically with the customer (D-06). `CustomerTable.tsx`'s `CustomerEditForm` gained an `accessToken` prop, loads the current config on modal open via `getReceiptConfig`, renders the same shared form under a "Receipts" heading, and persists via `upsertReceiptConfig(customer.id, ...)` after the existing customer update succeeds (D-07). Frontend build and `tsc --noEmit` both green (only the 4 pre-existing `warehouse.api.test.ts` errors remain). See `.planning/phases/05-customer-receipts-tab-replace-the-empty-available-after-the-/05-05-SUMMARY.md`.
- Decision: `toRequest` now takes `receiptValues` as a second argument so `createCustomerSchema.safeParse` validates fuel-surcharge range/precision; errors surface via a new `receiptError` state on the create form.
- Decision: edit-modal receipt-config save has no dedicated client-side zod validation (matching the rest of `CustomerEditForm`); backend `receiptConfigRequestSchema` still enforces 0-100/2dp, surfaced through the existing `serverError` catch.
- Phase 05 (Customer Receipts tab) complete: backend persistence, HTTP layer, atomic create-time persistence, frontend data layer + shared form, and both UI surfaces (create + edit) all shipped across 05-01 through 05-05.
