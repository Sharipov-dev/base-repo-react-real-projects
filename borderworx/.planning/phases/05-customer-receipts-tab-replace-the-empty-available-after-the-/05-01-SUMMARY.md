---
phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-
plan: 01
subsystem: database
tags: [prisma, postgres, zod, clean-architecture, backend]

# Dependency graph
requires:
  - phase: 04-customer-create-capture-primary-contact-name-phone-email-and
    provides: CreateCustomerUseCase / Prisma repository pattern for customer-scoped 1:1 config tables
provides:
  - CustomerReceiptConfig Prisma model (1:1 with Customer, cascade delete) pushed to the database
  - ReceiptConfig / UpsertReceiptConfigData domain entity
  - upsertReceiptConfigSchema / receiptConfigParamSchema Zod DTOs + ReceiptConfigResponseDto
  - ReceiptConfigRepository domain interface + PrismaReceiptConfigRepository implementation
  - ReceiptConfigMapper (Prisma Decimal -> number)
  - GetReceiptConfigUseCase (always returns a defaulted config, never null) + UpsertReceiptConfigUseCase
affects: [05-02 (HTTP layer: controller/routes/container wiring), 05-03 (atomic create-time persistence), customer]

# Tech tracking
tech-stack:
  added: []
  patterns: [1:1 customer-scoped config table with upsert-by-customerId, defaulted-read use-case for config entities]

key-files:
  created:
    - borderworxWMS/src/domain/entities/receipt-config.entity.ts
    - borderworxWMS/src/application/dto/receipt-config.dto.ts
    - borderworxWMS/src/domain/repositories/receipt-config.repository.ts
    - borderworxWMS/src/infrastructure/repositories/receipt-config.mapper.ts
    - borderworxWMS/src/infrastructure/repositories/prisma-receipt-config.repository.ts
    - borderworxWMS/src/application/use-cases/receipt-config/get-receipt-config.use-case.ts
    - borderworxWMS/src/application/use-cases/receipt-config/upsert-receipt-config.use-case.ts
  modified:
    - borderworxWMS/prisma/schema.prisma

key-decisions:
  - "CustomerReceiptConfig mirrors CustomerPackingSlipConfig exactly: customerId @unique, onDelete: Cascade, own DTO/entity/repo-interface/Prisma-repo/mapper/use-cases (D-05)"
  - "fuelSurchargePercentage stored as Decimal(5,2) default 0, converted to number via Prisma Decimal.toNumber() in the mapper (D-03)"
  - "GetReceiptConfigUseCase always returns a ReceiptConfig (never null) by synthesizing an all-defaults object when no row exists yet, so reads never 404 (D-06)"
  - "No columns added to the Customer model beyond the receiptConfig back-relation (D-05)"

patterns-established:
  - "Defaulted-read use-case pattern: Get*UseCase returns synthesized defaults instead of null/404 for 1:1 customer-scoped config entities"

requirements-completed: []

# Metrics
duration: 25min
completed: 2026-07-10
---

# Phase 5 Plan 1: CustomerReceiptConfig persistence layer Summary

**CustomerReceiptConfig Prisma model (1:1 Customer, cascade delete, Decimal(5,2) fuel surcharge) pushed to Postgres, with domain entity, Zod DTOs, repository, mapper, and get/upsert use-cases mirroring the CustomerPackingSlipConfig feature exactly.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-07-10T12:35:00Z
- **Completed:** 2026-07-10T13:00:58Z
- **Tasks:** 3 completed
- **Files modified:** 8 (1 modified, 7 created)

## Accomplishments
- `CustomerReceiptConfig` model added to `schema.prisma` (9 data fields + timestamps, `@@map("customer_receipt_configs")`), with `receiptConfig CustomerReceiptConfig?` back-relation on `Customer`
- Schema pushed to the database (`npx prisma db push` — "database is now in sync") and Prisma client regenerated; `prisma.customerReceiptConfig` delegate confirmed present and `CustomerReceiptConfig` type confirmed in generated `.d.ts`
- Domain entity, Zod DTO (with 0-100 range + 2-decimal-place validation on fuel surcharge), domain repository interface, Prisma repository + mapper, and get/upsert use-cases created, all mirroring the `CustomerPackingSlipConfig` precedent
- `GetReceiptConfigUseCase` returns a fully-defaulted `ReceiptConfig` (never null) when no row exists yet, satisfying D-06
- Backend `tsc --noEmit` (== `npm run typecheck`) passes with zero errors

## Task Commits

Each task was committed atomically (inside the `borderworxWMS` sub-repo):

1. **Task 1: Add CustomerReceiptConfig model, entity, DTO, and domain repository interface** - `0b1f69a` (feat)
2. **Task 2: [BLOCKING] Push schema and regenerate Prisma client** - no commit (schema already committed in Task 1; `db push`/`generate` touch only the database and the gitignored generated client, producing no new trackable file diff)
3. **Task 3: Add Prisma repository, mapper, and get/upsert use-cases** - `68ef254` (feat)

**Plan metadata:** committed in the parent repo (this SUMMARY.md + STATE.md/ROADMAP.md update)

## Files Created/Modified
- `borderworxWMS/prisma/schema.prisma` - added `CustomerReceiptConfig` model + `receiptConfig` back-relation on `Customer`
- `borderworxWMS/src/domain/entities/receipt-config.entity.ts` - `ReceiptConfig` + `UpsertReceiptConfigData` interfaces
- `borderworxWMS/src/application/dto/receipt-config.dto.ts` - `upsertReceiptConfigSchema`, `receiptConfigParamSchema`, `ReceiptConfigResponseDto`
- `borderworxWMS/src/domain/repositories/receipt-config.repository.ts` - `ReceiptConfigRepository` interface
- `borderworxWMS/src/infrastructure/repositories/receipt-config.mapper.ts` - Prisma record -> domain mapper (`Decimal.toNumber()`)
- `borderworxWMS/src/infrastructure/repositories/prisma-receipt-config.repository.ts` - `findByCustomerId` + `upsert`-by-`customerId`
- `borderworxWMS/src/application/use-cases/receipt-config/get-receipt-config.use-case.ts` - defaulted-read use-case (D-06)
- `borderworxWMS/src/application/use-cases/receipt-config/upsert-receipt-config.use-case.ts` - pass-through upsert use-case

## Decisions Made
None - followed plan as specified. All field names, defaults, and precision match D-01–D-04 exactly as prescribed by the plan.

## Deviations from Plan

None - plan executed exactly as written. `npx prisma format` was run after editing the schema to normalize column alignment (standard tooling step, not a functional deviation); `@db.Decimal(5, 2)` was reordered after `@map(...)` by the formatter but the attribute and precision are unchanged.

## Issues Encountered
None.

## User Setup Required

None - no external service configuration required. The database push targeted the existing local/dev Postgres instance already configured via `borderworxWMS/.env`.

## Next Phase Readiness
- `prisma.customerReceiptConfig` is live and typed; Plan 02 (HTTP layer: controller/routes/container wiring) and Plan 03 (atomic create-time persistence in `CreateCustomerUseCase`) can now build directly on `ReceiptConfigRepository`, `GetReceiptConfigUseCase`, and `UpsertReceiptConfigUseCase`.
- No blockers. The `CustomerPackingSlipConfig` controller/routes/container-wiring pattern is the direct template for Plan 02.

---
*Phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-*
*Completed: 2026-07-10*

## Self-Check: PASSED

All 7 created source files and the SUMMARY.md verified present on disk. Both task commits (`0b1f69a`, `68ef254`) verified present in `borderworxWMS` git history.
