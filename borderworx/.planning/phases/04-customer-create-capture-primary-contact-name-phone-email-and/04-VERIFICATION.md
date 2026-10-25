---
phase: 04-customer-create-capture-primary-contact-name-phone-email-and
verified: 2026-07-10T04:01:00Z
status: human_needed
score: 9/9 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Create a customer with the Primary Contact section left completely empty"
    expected: "Customer is created successfully; no customer_contacts row is created for it"
    why_human: "Requires a running app + DB to observe the actual API response and DB state; not verifiable from static code alone"
  - test: "Create a customer with First Name + Last Name + Email filled (Phone optional) in the Primary Contact section"
    expected: "Customer is created AND exactly one customer_contacts row exists for it with isPrimary:true, firstName/lastName/email/phone matching input"
    why_human: "Requires exercising the live $transaction against a real DB to confirm atomicity and correct isPrimary flag in practice"
  - test: "Fill only one Primary Contact field (e.g. First Name only) and attempt submit"
    expected: "Submit is blocked client-side; field-level errors appear under Last Name and Email; no network request is made; if bypassed and sent directly, the API returns 400 before any insert"
    why_human: "Requires visually observing form validation UX (error placement, no-API-call behavior) in a browser"
  - test: "Confirm the contact Email input never gets prefilled/synced from the Company Email field while typing in either input"
    expected: "The two email fields remain fully independent regardless of typing order"
    why_human: "Real-time UI behavior across two inputs; not something static analysis can prove absence of coupling for with full confidence in a live browser session"
---

# Phase 04: Customer create — capture Primary Contact Verification Report

**Phase Goal:** At customer-create time, allow the user to optionally capture a Primary Contact (name/phone/email); when provided, atomically create a matching customer_contacts record (isPrimary: true) alongside the customer.
**Verified:** 2026-07-10T04:01:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/customers accepts an optional primaryContact object and creates the customer with NO contact row when omitted | ✓ VERIFIED | `createCustomerSchema` in `borderworxWMS/src/application/dto/customer.dto.ts:23` has `primaryContact: createCustomerPrimaryContactSchema.optional()`; repository `create()` only inserts a contact `if (data.primaryContact)` (prisma-customer.repository.ts:47) |
| 2 | A full primaryContact {firstName,lastName,email(,phone)} creates a customer_contacts row with isPrimary:true, atomically with the customer | ✓ VERIFIED | `prisma-customer.repository.ts:29-61` wraps both `tx.customer.create` and `tx.customerContact.create({..., isPrimary: true})` inside a single `this.prisma.$transaction(async (tx) => {...})` |
| 3 | A partial primaryContact (missing firstName/lastName/email) is rejected with 400 before any insert | ✓ VERIFIED | `createCustomerPrimaryContactSchema` requires firstName (min 1), lastName (min 1), email (z.string().email()) — zod fails before the schema-validated body ever reaches the use-case/repository; `validate.middleware.ts` runs `safeParse` and short-circuits with a 400-producing `ValidationError` on failure, never calling `next()` toward the controller |
| 4 | Customer insert and contact insert run inside one Prisma $transaction; contact failure rolls back the customer | ✓ VERIFIED | Single `this.prisma.$transaction(async (tx) => {...})` block; both writes use the `tx` client, guaranteeing rollback-together semantics |
| 5 | Create Customer form (basics tab) shows a Primary Contact section with First name, Last name, Phone, Email inputs | ✓ VERIFIED | `CreateCustomerForm.tsx:275-316` renders a `<section>` titled "Primary Contact" with 4 `<Field>`/`<Input>` pairs for contactFirstName/contactLastName/contactPhone/contactEmail |
| 6 | Leaving every Primary Contact field empty submits the customer with no primaryContact | ✓ VERIFIED | `toRequest()` computes `hasAnyContact = cFirst \|\| cLast \|\| cEmail \|\| cPhone` and only spreads `{ primaryContact: {...} }` when truthy (CreateCustomerForm.tsx:56-79) |
| 7 | Filling First+Last+Email (Phone optional) sends a primaryContact object matching the backend shape | ✓ VERIFIED | Assembled object `{ firstName: cFirst, lastName: cLast, email: cEmail, phone: cPhone \|\| null }` structurally matches `CreateCustomerPrimaryContactRequest` / backend `createCustomerPrimaryContactSchema` exactly |
| 8 | A partial contact (some but not all required fields) blocks submit with field-level errors, no API call | ✓ VERIFIED | `createCustomerSchema.safeParse(toRequest(values))` runs before any `createCustomer()` call; on failure the nested `primaryContact.<sub>` zod issue paths are mapped to `contact*` FormValues keys and `setErrors` is called, then `return` — `createCustomer` is never invoked in the failure branch |
| 9 | The contact Email input is independent — never prefilled from the company Email field | ✓ VERIFIED | `empty.contactEmail = ''` (separate from `empty.email`), and `set('contactEmail', v)` only writes to `values.contactEmail`; no code path assigns `values.email` into `contactEmail` or vice versa |

**Score:** 9/9 truths verified (all backed by static code evidence; live behavioral confirmation still recommended — see Human Verification)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `borderworxWMS/src/application/dto/customer.dto.ts` | `createCustomerPrimaryContactSchema` + optional `primaryContact` on `createCustomerSchema` | ✓ VERIFIED | Present exactly as specified; `updateCustomerSchema` correctly does NOT include `primaryContact` (create-only, D-08) |
| `borderworxWMS/src/domain/entities/customer.entity.ts` | `CreateCustomerPrimaryContactData` + `primaryContact` on `CreateCustomerData` | ✓ VERIFIED | Both present; `UpdateCustomerData` untouched |
| `borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts` | Atomic customer + primary-contact creation | ✓ VERIFIED | `$transaction`, `tx.customerContact.create`, `isPrimary: true` all present and wired together |
| `borderworxWMSFrontend/src/modules/customer/model/schema.ts` | `createCustomerPrimaryContactSchema` + optional `primaryContact` on frontend `createCustomerSchema` | ✓ VERIFIED | Mirrors backend exactly; `updateCustomerSchema = createCustomerSchema.partial()` inherits but does not re-require it |
| `borderworxWMSFrontend/src/modules/customer/model/types.ts` | `primaryContact` on `CreateCustomerRequest` | ✓ VERIFIED | `CreateCustomerPrimaryContactRequest` + optional field present; `UpdateCustomerRequest` untouched |
| `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx` | Primary Contact form section + conditional `primaryContact` assembly | ✓ VERIFIED | Section rendered, `toRequest()`/`hasAnyContact` guard, nested error-path mapping all present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `prisma-customer.repository.ts` | `prisma.customerContact.create` (as `tx.customerContact.create`) | `$transaction` in `create()` | ✓ WIRED | `tx.customerContact.create({ data: { customerId: customer.id, firstName, lastName, email, phone, isPrimary: true } })` runs inside the same `tx` used for the customer insert |
| `customer.routes.ts` POST /customers | `createCustomerSchema` | `validate({ body: createCustomerSchema })` | ✓ WIRED | Confirmed at `customer.routes.ts:22`; middleware reassigns `req.body = result.data` on success, surfaces `body.primaryContact.<field>` errors on failure |
| `CreateCustomerForm.tsx` `toRequest()` | `createCustomer` API payload | `hasAnyContact` guard | ✓ WIRED | `primaryContact` key present in request object only when any contact field is non-empty; verified no other file (customer.api.ts) needed changes and none were made |
| Backend `CreateCustomerDto` | `CreateCustomerData` (domain) | pass-through `CreateCustomerUseCase.execute` | ✓ WIRED | `create-customer.use-case.ts` unchanged (`return this.customerRepository.create(data)`), confirmed structurally assignable since both types gained matching `primaryContact` shapes |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend typechecks clean | `cd borderworxWMS && npm run typecheck` | Exit 0, no output | ✓ PASS |
| Frontend typechecks — no NEW errors | `cd borderworxWMSFrontend && npx tsc --noEmit` | 4 pre-existing errors in `warehouse.api.test.ts` only (unrelated file, last modified April 2026, not touched by 04-01/04-02 commits) | ✓ PASS |
| Scope boundary — only declared files touched (backend) | `git diff --name-only bf51feb 745be44` | Exactly the 3 declared files | ✓ PASS |
| Scope boundary — only declared files touched (frontend) | `git diff --name-only 044668f e80d8a8` | Exactly the 3 declared files | ✓ PASS |
| Task commits exist and match SUMMARY claims | `git log --oneline` in both sub-repos | `93434a4`, `745be44` (backend), `ceb79aa`, `e80d8a8` (frontend) all present with matching messages | ✓ PASS |

Step 7b note: No live server/DB run was performed (would require starting the app + DB); the transaction's actual atomic-rollback behavior and DB row creation are covered under Human Verification below rather than an automated runtime check, per the "do not start servers" spot-check constraint.

### Requirements Coverage

This is a decision-derived phase (no REQUIREMENTS.md). Decisions D-01 through D-08 from `04-CONTEXT.md` are covered:

| Decision | Description | Status | Evidence |
|----------|-------------|--------|----------|
| D-01 | First/Last name as two separate inputs | ✓ SATISFIED | `firstName`/`lastName` fields throughout backend + frontend |
| D-02 | Email required when contact created; no DB relaxation | ✓ SATISFIED | `email: z.string().email()` required (no `.optional()`) in both `createCustomerPrimaryContactSchema` copies; `customer_contacts.email` remains NOT NULL in Prisma schema (unchanged) |
| D-03 | Single Phone field only, no mobile/jobTitle/department/notes on create | ✓ SATISFIED | Only `phone` present in both contact schemas; `mobile` explicitly absent (confirmed by plan's own acceptance grep and by direct read) |
| D-04 | Contact email independent, no prefill from company email | ✓ SATISFIED | Separate `contactEmail` state, `empty.contactEmail = ''`, no cross-assignment found |
| D-05 | Optional section; full set required, partial blocked | ✓ SATISFIED | `hasAnyContact` guard + zod required fields on partial object |
| D-06 | isPrimary:true; unsetPrimaryForCustomer correctly omitted as no-op | ✓ SATISFIED | `isPrimary: true` hardcoded in repository; omission reasoning is sound (no prior contacts exist for a brand-new customer) |
| D-07 | Atomic $transaction | ✓ SATISFIED | Single `this.prisma.$transaction(async (tx) => {...})` wraps both inserts |
| D-08 | Create-only, edit form untouched | ✓ SATISFIED | `updateCustomerSchema` / `UpdateCustomerData` / `UpdateCustomerRequest` all confirmed unchanged; edit form not in the modified-files list |

No orphaned requirements — all 8 decisions map to concrete plan tasks and were addressed by 04-01 (backend, D-01/02/03/05/06/07/08) and 04-02 (frontend, D-01/02/03/04/05/08).

### Anti-Patterns Found

None. No TODO/FIXME/placeholder comments, no empty stub handlers, no hardcoded static returns, and no disconnected props were found in any of the 6 modified files. The one pre-existing `PlaceholderPanel` component in `CreateCustomerForm.tsx` (used for the `receipts`/`orders`/`system` tabs) predates this phase and is unrelated to the Primary Contact feature — it is not touched by either plan's diff.

### Human Verification Required

### 1. Empty-contact submit path (live DB)

**Test:** In the running app, create a customer leaving all four Primary Contact fields blank, then submit.
**Expected:** Customer is created; querying `customer_contacts` for that customer's id returns zero rows.
**Why human:** Confirming actual DB state after a live request requires a running app + database; static code review can only confirm the code path that SHOULD produce this outcome.

### 2. Full-contact submit path (live DB, atomicity)

**Test:** Create a customer with First Name, Last Name, and Email filled (Phone optional), submit, then inspect the database.
**Expected:** Exactly one `customer_contacts` row exists for the new customer with `isPrimary = true` and the entered field values; the customer row itself also exists.
**Why human:** Verifying the `$transaction` truly commits both rows together (and would roll back both on a simulated failure) requires exercising real Prisma/Postgres behavior, which cannot be proven by reading source alone.

### 3. Partial-contact validation UX

**Test:** Fill in only the First Name field of the Primary Contact section and attempt to submit.
**Expected:** Submission is blocked; error messages appear under Last Name and Email fields; no network request fires (verify via browser dev tools Network tab); no customer is created.
**Why human:** Observing actual browser-rendered error placement and confirming zero network calls is a live UX check, not a static one.

### 4. Contact email independence, interactively

**Test:** Type a value into the Company Email field, then check the contact Email field (and vice versa) while filling out the form.
**Expected:** The two fields never sync or share a value under any interaction order.
**Why human:** Confirms real-time two-way independence in the rendered UI, which static code reading can only infer (correctly, in this case) but not observe directly.

### Gaps Summary

No gaps found. All 9 derived observable truths, all 6 required artifacts, and all 4 key links are verified against the actual code in both `borderworxWMS` and `borderworxWMSFrontend`. Backend typechecks clean; frontend typechecks introduce zero new errors (the 4 existing `warehouse.api.test.ts` errors are confirmed pre-existing — last touched in April 2026, untouched by any commit in this phase, and unrelated to the customer module). Git commit history in both sub-repos independently confirms the SUMMARY.md's claimed commits and file scope — no unexpected files were modified beyond what each plan declared.

Status is `human_needed` rather than `passed` solely because live behavioral confirmation (actual DB rows, actual browser validation UX, actual transaction rollback) has not been performed — this is expected and appropriate for a UI + DB-transaction feature; it does not indicate any defect found in the code.

---

*Verified: 2026-07-10T04:01:00Z*
*Verifier: Claude (gsd-verifier)*
