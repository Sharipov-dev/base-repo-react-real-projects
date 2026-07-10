---
phase: 04-customer-create-capture-primary-contact-name-phone-email-and
reviewed: 2026-07-10T00:15:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - borderworxWMS/src/application/dto/customer.dto.ts
  - borderworxWMS/src/domain/entities/customer.entity.ts
  - borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts
  - borderworxWMSFrontend/src/modules/customer/model/types.ts
  - borderworxWMSFrontend/src/modules/customer/model/schema.ts
  - borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-07-10T00:15:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the optional Primary Contact capture feature added to customer creation: backend Zod DTOs, domain entity types, the Prisma repository's atomic transaction, and the frontend form/schema/types. To confirm correctness across the call chain, I also traced `CreateCustomerUseCase`, `CustomerController`, `customer.routes.ts`, `validate.middleware.ts`, `customer.api.ts`, `customer-contact.dto.ts`, and the Prisma schema (`CustomerContact`/`Customer` models).

The core transaction logic is sound: `PrismaCustomerRepository.create` wraps `customer.create` and the conditional `customerContact.create` in a single `$transaction`, so a failure creating the contact correctly rolls back the customer row — this is the "atomic" behavior the phase requires. Route-level validation (`createCustomerSchema` via `validate.middleware.ts`) covers the new `primaryContact` field before it ever reaches the use case, and the frontend `toRequest()`/Zod flow correctly omits `primaryContact` when no contact fields are filled in and correctly surfaces field-level errors when a partial contact is submitted.

No critical/security issues were found. There are a few real validation gaps and drift risks worth fixing before this ships more broadly (e.g., a future "edit contact" flow), plus some quality/duplication items.

## Warnings

### WR-01: Primary contact name fields accept whitespace-only values

**File:** `borderworxWMS/src/application/dto/customer.dto.ts:4-5`
**Issue:** `createCustomerPrimaryContactSchema.firstName`/`lastName` use `z.string().min(1, ...)` with no `.trim()`/transform. `min(1)` only checks string length, so a direct API call (bypassing the frontend, which does `.trim()` in `toRequest()`) can create a `CustomerContact` row with `firstName: " "` or `lastName: "\t"` — a single whitespace character satisfies `min(1)`. This is a genuine data-integrity gap introduced by this feature, not just a pre-existing pattern reused verbatim (the equivalent `createCustomerContactSchema` in `customer-contact.dto.ts:7-8` has the identical gap, so it's systemic to contact validation but newly exercised by the create-customer path).
**Fix:**
```typescript
firstName: z.string().trim().min(1, 'First name is required').max(200),
lastName: z.string().trim().min(1, 'Last name is required').max(200),
```
Apply the same `.trim()` to the frontend `createCustomerPrimaryContactSchema` in `schema.ts:42-43` for defense in depth (the UI already trims before building the request, but the schema itself should not rely on caller discipline).

### WR-02: `primaryContact` field drifts between create and update DTOs across layers

**File:** `borderworxWMSFrontend/src/modules/customer/model/schema.ts:64`, `borderworxWMSFrontend/src/modules/customer/model/types.ts:70-83`, `borderworxWMS/src/application/dto/customer.dto.ts:26-43`
**Issue:** The frontend `updateCustomerSchema` is defined as `createCustomerSchema.partial()` (schema.ts:64), which means `z.infer<typeof updateCustomerSchema>` includes an optional `primaryContact` field inherited from the create schema. However:
- The hand-written `UpdateCustomerRequest` type (types.ts:70-83) has no `primaryContact` field at all.
- The backend `updateCustomerSchema` (customer.dto.ts:26-43) has no `primaryContact` field either — Prisma's `updateCustomerContactSchema`/patch route doesn't accept it.

If a future "edit customer" form is built against the frontend `updateCustomerSchema` (as opposed to `UpdateCustomerRequest`), a developer could reasonably assume `primaryContact` is a valid patch field since the inferred Zod type allows it, submit it, and have it silently stripped by the non-strict backend `updateCustomerSchema` with no error — a silent data-loss surprise, not a hard failure. This is a latent footgun rather than an active bug today (no update-customer form was in this review's scope), but it should be fixed now while the DTOs are fresh in this change.
**Fix:** Either explicitly `.omit({ primaryContact: true })` on the frontend `updateCustomerSchema`, or define it independently from `createCustomerSchema` rather than via `.partial()`, so its shape matches `UpdateCustomerRequest` and the backend update DTO exactly.

### WR-03: Primary Contact fields give no visual cue that they become required

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx:283-314`
**Issue:** The section subtitle states "If you add a contact, first name, last name and email are required" (line 279-281), and this is correctly enforced by validation — but none of the three `Field` components for First Name, Last Name, Email pass `required` (compare to `Company Name` at line 183, which does pass `required` and renders a red asterisk). Users get no visual indicator of which fields are conditionally mandatory until they submit and see an error, which is a real usability regression compared to the rest of the form's pattern.
**Fix:**
```tsx
<Field label="First Name" required error={errors.contactFirstName}>
<Field label="Last Name" required error={errors.contactLastName}>
...
<Field label="Email" required error={errors.contactEmail}>
```
(Conditionally required is still a UX compromise — e.g. via a computed `hasAnyContact` check on the client, showing the asterisk once phone is typed — but even a static asterisk here is more correct than none for fields that are validated as required whenever the section is touched.)

## Info

### IN-01: Contact validation schema duplicated between two DTO files

**File:** `borderworxWMS/src/application/dto/customer.dto.ts:3-8`, `borderworxWMS/src/application/dto/customer-contact.dto.ts:5-16`
**Issue:** `createCustomerPrimaryContactSchema` (firstName/lastName/email/phone with identical constraints) duplicates the corresponding fields of `createCustomerContactSchema`. Any future change to contact validation rules (e.g., adding trim, tightening max length) has to be made in two places or they'll drift apart (as in WR-01, which already technically applies to both but was only fixed in one place if addressed piecemeal).
**Fix:** Extract a shared base object (e.g., `contactPersonFieldsSchema`) in a common module and compose both schemas from it via `.extend()`/`.merge()`.

### IN-02: Dead fallback branch in client-side error-field mapping

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx:110-116`
**Issue:** The ternary chain maps `primaryContact` sub-errors to form fields, defaulting anything that isn't `firstName`/`lastName`/`email` to `'contactPhone'`. Because `toRequest()` (lines 56-79) always constructs `primaryContact` as a plain object with exactly those four keys, `issue.path[1]` can never be anything other than one of the four contact keys in practice — the default branch is unreachable given the current construction of the request payload, and if it *did* trigger (e.g. a schema-level `.refine()` error attached to the whole `primaryContact` object with no sub-path), it would misleadingly attribute the error to the phone field.
**Fix:** Make the fallback explicit/safer, e.g. only map recognized sub-paths and otherwise attach the error to a general `serverError`/form-level message rather than silently mislabeling it as a phone error.

### IN-03: `'United States'` default duplicated across three layers

**File:** `borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts:38`, `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx:44`, `borderworxWMS/prisma/schema.prisma:157`
**Issue:** The default country value `'United States'` is hardcoded independently in the Prisma schema default, the repository's `data.country ?? 'United States'` fallback (which is actually redundant given the Prisma column default, since `create` would apply the DB default if the key were omitted entirely rather than explicitly passed as `undefined` — worth double-checking whether passing `country: undefined` to Prisma's `create` triggers the schema default or requires the key to be absent), and the form's initial state. Three independent copies of the same magic string will drift silently if the business default ever changes.
**Fix:** Define a single exported constant (e.g., `DEFAULT_CUSTOMER_COUNTRY`) shared by backend and reused in frontend config, or rely solely on the Prisma column default and drop the `?? 'United States'` fallback in the repository if confirmed redundant.

### IN-04: Unchecked type assertion and non-null assertion in form component

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx:118, 341`
**Issue:** Line 118 uses `issue.path[0] as keyof FormValues` — an `as` type assertion that the project's own frontend `CLAUDE.md` explicitly discourages ("No `any` types. No `as Type` assertions on API data"). While this operates on a local Zod issue path rather than raw API data, if `createCustomerSchema`'s top-level keys ever diverge from `FormValues` keys (e.g., a new schema field is added without a corresponding form field), this would silently produce a `fieldErrors[undefined]` entry rather than a compile error. Line 341's `tabs.find((t) => t.key === tab)!` non-null assertion is safe today (given `tab`'s type is constrained to the `Tab` union used to build `tabs`), but is a code smell that would fail silently (rendering `undefined` label) if `tabs` were ever filtered dynamically.
**Fix:** Use a typed lookup/mapping object instead of an assertion for line 118 (e.g., a `Record<string, keyof FormValues>` built once), and for line 341 use `tabs.find((t) => t.key === tab) ?? tabs[0]` to avoid the non-null assertion.

---

_Reviewed: 2026-07-10T00:15:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
