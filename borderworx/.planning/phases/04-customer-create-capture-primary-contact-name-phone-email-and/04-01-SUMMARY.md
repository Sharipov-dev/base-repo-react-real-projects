---
phase: 04-customer-create-capture-primary-contact-name-phone-email-and
plan: 01
subsystem: api
tags: [zod, prisma, express, clean-architecture, customer, transaction]

# Dependency graph
requires: []
provides:
  - "createCustomerSchema accepts an optional primaryContact object (firstName, lastName, email required; phone optional)"
  - "CreateCustomerData domain type carries optional primaryContact via CreateCustomerPrimaryContactData"
  - "PrismaCustomerRepository.create() wraps customer + primary contact insert in a single $transaction"
affects: [04-customer-create-frontend, customer-contacts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Repository-level $transaction for atomic multi-table writes on create (mirrors prisma-receipt.repository.ts precedent)"

key-files:
  created: []
  modified:
    - borderworxWMS/src/application/dto/customer.dto.ts
    - borderworxWMS/src/domain/entities/customer.entity.ts
    - borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts

key-decisions:
  - "Transaction placed in the repository, not the use-case, keeping CreateCustomerUseCase a pure pass-through and CustomerMapper confined to infrastructure"
  - "unsetPrimaryForCustomer step from CreateCustomerContactUseCase deliberately omitted (no-op on a brand-new customer with no prior contacts)"

patterns-established:
  - "Optional nested payload (primaryContact) validated by a dedicated exported zod schema, spliced onto the parent create schema only (not the update schema)"

requirements-completed: [D-01, D-02, D-03, D-05, D-06, D-07, D-08]

# Metrics
duration: 3min
completed: 2026-07-10
---

# Phase 04 Plan 01: Customer Create — Atomic Primary Contact Summary

**POST /api/customers now accepts an optional primaryContact payload and creates the customer_contacts row (isPrimary:true) atomically with the customer via a single Prisma $transaction**

## Performance

- **Duration:** 3 min
- **Started:** 2026-07-10T03:49:00Z
- **Completed:** 2026-07-10T03:51:47Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments
- `createCustomerSchema` (borderworxWMS/src/application/dto/customer.dto.ts) gained an optional `primaryContact` field backed by a new exported `createCustomerPrimaryContactSchema` (firstName/lastName/email required, phone optional) — omitted entirely means no contact is created; a partial object fails required-field validation and produces a 400 before any insert.
- `CreateCustomerData` (borderworxWMS/src/domain/entities/customer.entity.ts) gained a matching optional `primaryContact?: CreateCustomerPrimaryContactData` field, keeping `CreateCustomerDto` structurally assignable so the pass-through `CreateCustomerUseCase` needed zero changes.
- `PrismaCustomerRepository.create()` now wraps the customer insert and the conditional `customerContact` insert (with `isPrimary: true`) inside a single `this.prisma.$transaction(async (tx) => {...})`, guaranteeing the contact insert failing rolls back the customer.

## Task Commits

Each task was committed atomically (in the `borderworxWMS` sub-repo):

1. **Task 1: Add optional primaryContact to createCustomerSchema (DTO)** - `93434a4` (feat)
2. **Task 2: Atomic customer + primary-contact creation in the repository** - `745be44` (feat)

**Plan metadata:** committed separately in the parent repo (this SUMMARY.md + STATE.md + ROADMAP.md update)

## Files Created/Modified
- `borderworxWMS/src/application/dto/customer.dto.ts` - Added `createCustomerPrimaryContactSchema`, spliced `primaryContact` optional field onto `createCustomerSchema`, exported `CreateCustomerPrimaryContactDto`
- `borderworxWMS/src/domain/entities/customer.entity.ts` - Added `CreateCustomerPrimaryContactData` interface, `primaryContact` optional field on `CreateCustomerData`
- `borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts` - Rewrote `create()` to use `$transaction`, conditionally creating a `customerContact` row with `isPrimary: true` when `data.primaryContact` is present

## Decisions Made
- Followed the plan's explicit guidance to place the `$transaction` in the repository (matches `prisma-receipt.repository.ts` precedent) rather than in the use-case, preserving the pass-through `CreateCustomerUseCase` and keeping infrastructure concerns (Prisma, `CustomerMapper`) out of the application layer.
- Left `unsetPrimaryForCustomer` (used elsewhere by `CreateCustomerContactUseCase`) out of the new transaction — it is a correctness no-op here since a brand-new customer has no prior contacts to unset.
- Did not touch `updateCustomerSchema`, `UpdateCustomerData`, `CreateCustomerUseCase`, `customer.controller.ts`, `customer.routes.ts`, or `container.ts`, per the plan's explicit scope boundary — verified via `git diff --name-only` after both tasks.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both tasks matched the plan's prescribed code verbatim; `npm run typecheck` passed cleanly after each task with no iteration needed.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Backend fully supports optional atomic primary-contact creation on `POST /api/customers`; no frontend changes were in scope for this plan.
- Frontend customer-create form (a later plan/phase) can now send a `primaryContact: { firstName, lastName, email, phone? }` object in the create payload to get an atomically-created primary contact, or omit the key entirely for no contact.
- No blockers identified for subsequent phases (Phase 05 — Customer Receipts tab — is unrelated to this change and depends only on the customer entity shape, which is unchanged).

---
*Phase: 04-customer-create-capture-primary-contact-name-phone-email-and*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files confirmed on disk; both task commits (`93434a4`, `745be44`) confirmed in `borderworxWMS` git history.
