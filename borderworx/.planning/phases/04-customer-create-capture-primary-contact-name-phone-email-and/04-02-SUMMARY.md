---
phase: 04-customer-create-capture-primary-contact-name-phone-email-and
plan: 02
subsystem: frontend
tags: [zod, react, nextjs, customer, form]

# Dependency graph
requires: ["04-01"]
provides:
  - "CreateCustomerRequest carries an optional primaryContact (firstName/lastName/email required, phone optional)"
  - "createCustomerSchema (frontend) mirrors the backend optional primaryContact validation via createCustomerPrimaryContactSchema"
  - "CreateCustomerForm basics tab renders a Primary Contact section wired to primaryContact assembly and nested field-error mapping"
affects: [customer-contacts]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Conditional nested payload assembly (primaryContact only sent when any contact field has content) using a hasAnyContact guard in toRequest"
    - "Nested zod issue.path mapping (primaryContact.<sub> -> contact<Sub> FormValues key) for field-level error display"

key-files:
  created: []
  modified:
    - borderworxWMSFrontend/src/modules/customer/model/types.ts
    - borderworxWMSFrontend/src/modules/customer/model/schema.ts
    - borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx

key-decisions:
  - "Contact email field is fully independent state (contactEmail) and never seeded from the company email field, matching D-04"
  - "primaryContact object is omitted entirely from the request when all four contact fields are empty, matching D-05 and the backend's optional-object contract from 04-01"

patterns-established:
  - "Frontend request schemas mirror backend optional nested-object schemas exactly (same required set), spliced onto the create schema only, never the update schema"

requirements-completed: [D-01, D-02, D-03, D-04, D-05, D-08]

# Metrics
duration: 6min
completed: 2026-07-10
---

# Phase 04 Plan 02: Customer Create — Primary Contact Frontend Summary

**Create Customer form now has an optional Primary Contact section (First/Last/Phone/Email) that sends a `primaryContact` object to `POST /api/customers` only when filled, enforcing First+Last+Email client-side**

## Performance

- **Duration:** 6 min
- **Started:** 2026-07-10T03:51:47Z (immediately following 04-01)
- **Completed:** 2026-07-10T03:57:28Z
- **Tasks:** 2 completed
- **Files modified:** 3

## Accomplishments

- `CreateCustomerRequest` (borderworxWMSFrontend/src/modules/customer/model/types.ts) gained a new `CreateCustomerPrimaryContactRequest` interface and an optional `primaryContact` field, mirroring the backend contract established in 04-01. `UpdateCustomerRequest` was left untouched (create-only, D-08).
- `createCustomerSchema` (borderworxWMSFrontend/src/modules/customer/model/schema.ts) gained a new exported `createCustomerPrimaryContactSchema` (firstName/lastName required strings, email required+validated, phone optional) spliced onto `createCustomerSchema` as `primaryContact: createCustomerPrimaryContactSchema.optional()`. `updateCustomerSchema` (derived via `.partial()`) was left untouched per plan scope.
- `CreateCustomerForm.tsx` gained a "Primary Contact" section on the basics tab with First Name, Last Name, Phone, and Email inputs, reusing the existing `<Field>`/`<Input>` helpers. `FormValues` was extended with `contactFirstName`/`contactLastName`/`contactPhone`/`contactEmail`, all starting blank (contact email is never prefilled from the company email field, D-04). `toRequest()` now assembles a `primaryContact` object only when at least one contact field has content (`hasAnyContact` guard, D-05); the submit error-mapping loop was extended to translate nested `primaryContact.<sub>` zod issue paths to the matching `contact*` FormValues keys so field-level errors render on the correct inputs.

## Task Commits

Each task was committed atomically (in the `borderworxWMSFrontend` sub-repo):

1. **Task 1: Extend frontend type + zod schema with primaryContact** - `ceb79aa` (feat)
2. **Task 2: Add Primary Contact section to CreateCustomerForm** - `e80d8a8` (feat)

**Plan metadata:** committed separately in the parent repo (this SUMMARY.md + STATE.md + ROADMAP.md update)

## Files Created/Modified

- `borderworxWMSFrontend/src/modules/customer/model/types.ts` - Added `CreateCustomerPrimaryContactRequest`, added optional `primaryContact` field to `CreateCustomerRequest`
- `borderworxWMSFrontend/src/modules/customer/model/schema.ts` - Added `createCustomerPrimaryContactSchema`, spliced `primaryContact: createCustomerPrimaryContactSchema.optional()` onto `createCustomerSchema`
- `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx` - Extended `FormValues`/`empty` with 4 contact fields, rewrote `toRequest()` to conditionally assemble `primaryContact` via a `hasAnyContact` guard, extended the submit error-mapping loop for nested `primaryContact` zod paths, and added a "Primary Contact" `<section>` (First Name, Last Name, Phone, Email) to the basics tab between "Customer Information" and the server-error block

## Decisions Made

- Followed the plan's explicit code verbatim for both the type/schema extension and the form section — no structural deviation from the 04-01 backend contract.
- Confirmed via `git diff --name-only` that `src/modules/customer/api/customer.api.ts` was not touched — `createCustomer()` already forwards the whole request body, so no API function change was needed.
- Left the customer edit form untouched (create-only, D-08).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npx tsc --noEmit` reports 4 pre-existing errors in `src/modules/warehouse/__tests__/warehouse.api.test.ts` (unrelated `WarehouseDTO` snake_case/camelCase mismatches). Confirmed via `git stash` that these errors exist on the base branch prior to this plan's changes — out of scope per the deviation rules' scope boundary (unrelated file, not touched by this task). No customer-module tsc errors were introduced by this plan's changes. Logged here rather than in a separate `deferred-items.md` since it is a single, previously-known, unrelated test-file issue.
- A pre-existing unstaged modification to `borderworxWMSFrontend/src/modules/role/ui/RoleTable.tsx` was present in the working tree before this plan started and remains untouched/uncommitted by this plan (out of scope, unrelated module).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 04 (Customer create — capture Primary Contact) is now fully implemented end-to-end: backend (04-01) accepts and atomically persists an optional `primaryContact`; frontend (04-02) collects it via an optional form section, validates the required set (First+Last+Email) client-side, and omits the key entirely when the section is left empty.
- Manual smoke test recommended before considering the phase closed: create a customer with the contact section empty (succeeds, no contact row), with First+Last+Email filled (succeeds, contact row created via 04-01's transaction), and with only one contact field filled (blocked client-side with field errors, no API call).
- No blockers for Phase 05 (Customer Receipts tab) — unrelated to this change, depends only on the customer entity shape, which is unchanged.

---
*Phase: 04-customer-create-capture-primary-contact-name-phone-email-and*
*Completed: 2026-07-10*

## Self-Check: PASSED

All created/modified files confirmed on disk; both task commits (`ceb79aa`, `e80d8a8`) confirmed in `borderworxWMSFrontend` git history.
