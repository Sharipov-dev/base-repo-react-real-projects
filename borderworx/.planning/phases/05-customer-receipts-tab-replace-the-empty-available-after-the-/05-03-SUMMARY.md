---
phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-
plan: 03
subsystem: api
tags: [zod, prisma, express, clean-architecture, customer, transaction]

# Dependency graph
requires:
  - phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-
    provides: CustomerReceiptConfig Prisma model, UpsertReceiptConfigData domain type, upsertReceiptConfigSchema Zod DTO (Plan 01)
  - phase: 04-customer-create-capture-primary-contact-name-phone-email-and
    provides: Repository-level $transaction precedent for atomic create-time customer + related-table writes (Plan 01)
provides:
  - "createCustomerSchema accepts an optional receiptConfig object (D-06)"
  - "CreateCustomerData domain type carries optional receiptConfig via UpsertReceiptConfigData"
  - "PrismaCustomerRepository.create() writes customer + optional primaryContact + optional receiptConfig in ONE $transaction"
affects: [05-04-frontend-create-form, 05-05-frontend-edit-form]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository-level $transaction extended to cover N optional related-table writes (customerContact + customerReceiptConfig), not just one"

key-files:
  created: []
  modified:
    - borderworxWMS/src/application/dto/customer.dto.ts
    - borderworxWMS/src/domain/entities/customer.entity.ts
    - borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts

key-decisions:
  - "receiptConfig create-field defaults (?? false / ?? 0) mirror PrismaReceiptConfigRepository.upsert's create branch exactly, keeping default semantics identical across atomic-create and standalone-upsert code paths"
  - "receiptConfig deliberately NOT added to updateCustomerSchema/UpdateCustomerData — edits to receipt config persist via the dedicated PATCH /customers/:customerId/receipt-config endpoint (D-07), not the customer PATCH"
  - "Transaction remains in the repository (not the use-case), extending Phase 4's primaryContact precedent rather than introducing a second transaction pattern"

patterns-established:
  - "Multi-optional-payload create transaction: a single repository create() method can conditionally write to N related tables in one $transaction as the domain type grows more optional nested payloads"

requirements-completed: []

# Metrics
duration: 12min
completed: 2026-07-10
---

# Phase 05 Plan 03: Atomic Receipt-Config Persistence at Customer-Create Summary

**POST /api/customers now accepts an optional receiptConfig payload and creates the customer_receipt_configs row atomically with the customer (and optional primary contact) via the same Prisma $transaction established in Phase 4.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-07-10T13:10:00Z
- **Completed:** 2026-07-10T13:22:00Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `createCustomerSchema` (borderworxWMS/src/application/dto/customer.dto.ts) gained an optional `receiptConfig: upsertReceiptConfigSchema.optional()` field, imported from Plan 01's `receipt-config.dto.ts`. `updateCustomerSchema` deliberately left untouched.
- `CreateCustomerData` (borderworxWMS/src/domain/entities/customer.entity.ts) gained a matching optional `receiptConfig?: UpsertReceiptConfigData` field, importing the type from Plan 01's `receipt-config.entity.ts`. `UpdateCustomerData` deliberately left untouched.
- `PrismaCustomerRepository.create()` now conditionally writes a `tx.customerReceiptConfig.create` call inside the SAME `$transaction` that Phase 4 introduced for the optional `tx.customerContact.create` — both the primary contact and the receipt config (independently optional) roll back together with the customer row if either insert fails. Field defaults (`?? false` / `?? 0`) mirror `PrismaReceiptConfigRepository.upsert`'s create branch exactly.
- `CreateCustomerUseCase` and `customer.controller.ts` were not touched — confirmed via `git diff --name-only` — preserving the Phase 4 pass-through precedent.

## Task Commits

Each task was committed atomically (inside the `borderworxWMS` sub-repo):

1. **Task 1: Extend create contract (DTO + domain entity) with optional receiptConfig** - `30879ca` (feat)
2. **Task 2: Persist receipt config atomically inside the customer-create $transaction** - `1da8762` (feat)

**Plan metadata:** committed separately in the parent repo (this SUMMARY.md + STATE.md + ROADMAP.md update)

## Files Created/Modified
- `borderworxWMS/src/application/dto/customer.dto.ts` - Imported `upsertReceiptConfigSchema`; added `receiptConfig: upsertReceiptConfigSchema.optional()` to `createCustomerSchema` only
- `borderworxWMS/src/domain/entities/customer.entity.ts` - Imported `UpsertReceiptConfigData`; added `receiptConfig?: UpsertReceiptConfigData` to `CreateCustomerData` only
- `borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts` - Extended the existing `create()` `$transaction` with a conditional `tx.customerReceiptConfig.create` block (after the existing conditional `tx.customerContact.create`), using the same `?? false` / `?? 0` default mapping as `PrismaReceiptConfigRepository.upsert`

## Decisions Made
- Followed the plan's explicit code exactly: field-by-field defaults for the receipt-config create block match `PrismaReceiptConfigRepository.upsert`'s create branch verbatim, keeping default semantics consistent whether a config is created atomically at customer-create time or later via the standalone upsert endpoint.
- Did not touch `updateCustomerSchema`, `UpdateCustomerData`, `CreateCustomerUseCase`, or `customer.controller.ts` — verified via `git diff --name-only` after Task 2, matching the plan's explicit scope boundary and the Phase 4 precedent.

## Deviations from Plan

None - plan executed exactly as written. Both tasks matched the plan's prescribed code verbatim.

## Issues Encountered

None. `npx tsc --noEmit` passed cleanly after Task 1 with zero new errors; `npm run build` passed cleanly after Task 2 with zero errors.

## User Setup Required

None - no external service configuration required. This plan builds entirely on the `CustomerReceiptConfig` Prisma model and Prisma client already generated in Plan 01.

## Next Phase Readiness

- Backend fully supports optional atomic receipt-config creation on `POST /api/customers`: omit `receiptConfig` entirely for no config row, or send a partial/full `receiptConfig` object (any subset of the 9 fields) to get an atomically-created config row with per-field defaults for anything omitted.
- Plans 04/05 (frontend create/edit Receipts tab) can now send `receiptConfig: { ... }` in the create payload to persist receipt settings together with the new customer, with no orphaned partial writes if either insert fails.
- No blockers identified for subsequent plans.

---
*Phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 3 modified files confirmed on disk with expected content (`grep` checks for `receiptConfig: upsertReceiptConfigSchema.optional()`, `receiptConfig?: UpsertReceiptConfigData`, `$transaction`, `tx.customerReceiptConfig.create`, `if (data.receiptConfig)` all passed). Both task commits (`30879ca`, `1da8762`) confirmed present in `borderworxWMS` git history via `git log --oneline`.
