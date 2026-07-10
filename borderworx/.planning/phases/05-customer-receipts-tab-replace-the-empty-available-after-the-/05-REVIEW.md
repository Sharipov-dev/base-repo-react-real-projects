---
phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-
reviewed: 2026-07-10T13:41:47Z
depth: standard
files_reviewed: 22
files_reviewed_list:
  - borderworxWMS/src/domain/entities/receipt-config.entity.ts
  - borderworxWMS/src/application/dto/receipt-config.dto.ts
  - borderworxWMS/src/domain/repositories/receipt-config.repository.ts
  - borderworxWMS/src/infrastructure/repositories/receipt-config.mapper.ts
  - borderworxWMS/src/infrastructure/repositories/prisma-receipt-config.repository.ts
  - borderworxWMS/src/application/use-cases/receipt-config/get-receipt-config.use-case.ts
  - borderworxWMS/src/application/use-cases/receipt-config/upsert-receipt-config.use-case.ts
  - borderworxWMS/src/interfaces/http/controllers/receipt-config.controller.ts
  - borderworxWMS/src/interfaces/http/routes/receipt-config.routes.ts
  - borderworxWMS/src/interfaces/http/routes/router.ts
  - borderworxWMS/src/main/container.ts
  - borderworxWMS/src/application/dto/customer.dto.ts
  - borderworxWMS/src/domain/entities/customer.entity.ts
  - borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts
  - borderworxWMSFrontend/src/modules/customer/model/types.ts
  - borderworxWMSFrontend/src/modules/customer/model/schema.ts
  - borderworxWMSFrontend/src/modules/customer/lib/mapReceiptConfig.ts
  - borderworxWMSFrontend/src/modules/customer/lib/receiptConfig.ts
  - borderworxWMSFrontend/src/modules/customer/api/customer.api.ts
  - borderworxWMSFrontend/src/modules/customer/ui/ReceiptSettingsForm.tsx
  - borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx
  - borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx
findings:
  critical: 4
  warning: 4
  info: 2
  total: 10
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-07-10T13:41:47Z
**Depth:** standard
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the CustomerReceiptConfig feature end-to-end: domain entity, DTOs, mapper, Prisma repository, use cases, controller/routes, DI wiring, and the frontend shared `ReceiptSettingsForm` wired into both the create flow and the edit modal.

DTO↔domain mapping is faithful (1:1 field mapping in both `ReceiptConfigMapper.toDomain` and `mapReceiptConfig`), the `$transaction` in `PrismaCustomerRepository.create` correctly wraps the customer, optional primary-contact, and optional receipt-config inserts atomically, and the shared-form controlled-component contract (`values`/`onChange`) is used consistently.

However, the fuel-surcharge precision `.refine()` has a floating-point bug that rejects common, perfectly valid 2-decimal-place values on both the client and server, and — more seriously — the customer **edit** flow (unlike create) is not atomic: the modal closes and the parent unmounts the form before the receipt-config PUT request is even issued, so a failure there (including the precision bug above) is silently swallowed with no user-visible error, while the customer's basic fields have already been persisted. A second silent-failure path exists when the initial `getReceiptConfig` fetch errors out during edit — the form falls back to all-disabled defaults with no warning, risking a destructive overwrite of the customer's real settings on submit.

## Critical Issues

### CR-01: Floating-point bug in fuel-surcharge precision check rejects valid values (backend)

**File:** `borderworxWMS/src/application/dto/receipt-config.dto.ts:6-11`
**Issue:** The 2-decimal-place check `Math.round(v * 100) === v * 100` fails for many legitimate values due to IEEE-754 floating point rounding. Verified directly:
```
19.99 * 100 === 1998.9999999999998   // Math.round(...) !== v*100 → FAILS validation
29.99 * 100 === 2999                 // passes
```
So a user entering `19.99` (or `9.99`, `59.99`... any value whose `*100` product lands just under an integer) gets a hard validation error ("Up to 2 decimal places") for a perfectly valid 2-decimal amount. This affects both `PUT /customers/:customerId/receipt-config` and the `receiptConfig` sub-schema used by `POST /customers`.
**Fix:** Use an epsilon-tolerant or string-based check, e.g.:
```typescript
fuelSurchargePercentage: z
  .number()
  .min(0, 'Must be 0 or greater')
  .max(100, 'Must be 100 or less')
  .refine((v) => Math.round(v * 100) === Math.round(v * 100 * 1) && Number.isInteger(Math.round(v * 100 - Math.round(v * 100)) === 0), 'Up to 2 decimal places')
```
More simply, round first and compare with a tolerance:
```typescript
.refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Up to 2 decimal places')
```

### CR-02: Same floating-point precision bug duplicated on the frontend

**File:** `borderworxWMSFrontend/src/modules/customer/model/schema.ts:67-71`
**Issue:** Identical `.refine((v) => Math.round(v * 100) === v * 100, ...)` logic in `receiptConfigRequestSchema`, so the client-side `createCustomerSchema.safeParse(...)` in `CreateCustomerForm` will reject the same valid values (e.g. `19.99`) before the request is even sent, blocking users from saving a common surcharge value.
**Fix:** Apply the same epsilon-tolerant fix as CR-01, keeping both schemas in sync:
```typescript
.refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, 'Up to 2 decimal places')
```

### CR-03: Customer edit flow closes the modal (unmounting the form) before the receipt-config save completes — errors are silently lost

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx:58-63` (`handleUpdate`) and `:368-393` (`CustomerEditForm.handleSubmit`)
**Issue:**
```typescript
// handleUpdate (parent, passed as onSubmit)
async function handleUpdate(payload: UpdateCustomerRequest) {
  if (!editItem) return;
  await updateCustomer(editItem.id, payload, accessToken);
  queryClient.invalidateQueries({ queryKey: ['customers'] });
  setEditItem(null);            // <-- closes the Modal, unmounts CustomerEditForm
}

// CustomerEditForm.handleSubmit
try {
  await onSubmit({...});        // resolves *after* setEditItem(null) has already run
  await upsertReceiptConfig(customer.id, receiptFormValuesToRequest(receiptValues), accessToken);
} catch (err) {
  setServerError(...);          // form is already unmounted — user never sees this
} finally {
  setSubmitting(false);         // no-op on unmounted component
}
```
`onSubmit` (i.e. `handleUpdate`) sets `editItem` to `null` as its last step, which closes the `Modal` and unmounts `CustomerEditForm` on the next render. The `upsertReceiptConfig` call is issued *after* that, from a component that is in the process of being torn down. If it fails for any reason (the CR-01/CR-02 precision bug, a network blip, a stale/invalid value), the `catch` block's `setServerError` call has no visible effect — the modal is already closed and the receipt-config changes are silently dropped, while the customer's basic fields were already persisted and the list already invalidated/refetched. This is materially different from (and less safe than) the atomic `$transaction` used at customer-create time, and it is a genuine silent-data-loss / broken-error-handling bug.
**Fix:** Persist both pieces of data before closing the modal — either combine into a single backend transaction/endpoint, or sequence the two client calls and only close the modal after both succeed:
```typescript
// CustomerEditForm.handleSubmit
await onUpdateCustomerOnly(payload);           // does NOT close the modal
await upsertReceiptConfig(customer.id, receiptFormValuesToRequest(receiptValues), accessToken);
onSuccess();                                    // parent closes modal + invalidates queries here, only after both succeed
```

### CR-04: Silent failure of the receipt-config fetch on edit can lead to overwriting real settings with defaults

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx:352-361`
**Issue:**
```typescript
useEffect(() => {
  let active = true;
  getReceiptConfig(customer.id, accessToken)
    .then((c) => { if (active) setReceiptValues(receiptConfigToFormValues(c)); })
    .catch(() => {});   // <-- error fully swallowed, no error state, no retry, no disabling of the receipts tab
  return () => { active = false; };
}, [customer.id, accessToken]);
```
If this fetch fails for any reason other than "no config row exists yet" (the backend already returns sane all-`false`/`0` defaults for that case via `GetReceiptConfigUseCase`, so a real network/auth/parse error is the only way this `catch` fires), `receiptValues` silently stays at `emptyReceiptConfigValues` (all toggles off, 0% surcharge) with zero indication to the user that their existing settings failed to load. If the user then edits any other field on the same form and submits, `upsertReceiptConfig` will overwrite the customer's real, previously-saved receipt configuration with all-disabled defaults — a destructive, invisible data-loss bug.
**Fix:** Surface the error and prevent submission of stale/default receipt data, e.g.:
```typescript
const [receiptLoadError, setReceiptLoadError] = useState(false);
...
.catch(() => { if (active) setReceiptLoadError(true); });
...
// in handleSubmit, skip/guard the upsertReceiptConfig call (or block submit) when receiptLoadError is true
```

## Warnings

### WR-01: Receipt-config validation errors are not surfaced in the edit modal

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx:444-447`
**Issue:** `CustomerEditForm` renders `<ReceiptSettingsForm values={receiptValues} onChange={...} />` without an `error` prop, unlike `CreateCustomerForm` which passes `error={receiptError}`. Any fuel-surcharge validation failure from the backend (e.g. from CR-01) surfaces only as a generic top-level `serverError` string, not attributed to the specific field, which is an inconsistent UX between the two entry points for the same shared component.
**Fix:** Parse the thrown error for a field-level message and pass it through, mirroring the create-form pattern.

### WR-02: Edit form bypasses Zod validation entirely (unlike the create form)

**File:** `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx:368-393`
**Issue:** `CustomerEditForm.handleSubmit` builds the `UpdateCustomerRequest`/receipt-config payloads and sends them directly to `onSubmit`/`upsertReceiptConfig` with no client-side `safeParse` against `updateCustomerSchema` / `receiptConfigRequestSchema`. `CreateCustomerForm` validates via `createCustomerSchema.safeParse(...)` before submitting. This is an inconsistent validation strategy across the two forms sharing the same domain rules, and it means malformed edit input (bad URL/email format, out-of-range surcharge) is only ever caught by the backend, producing an unstructured `serverError` string instead of field-level feedback.
**Fix:** Run `updateCustomerSchema.safeParse(...)` and `receiptConfigRequestSchema.safeParse(...)` in `CustomerEditForm.handleSubmit` and map issues to per-field errors, matching the create-form pattern.

### WR-03: `PUT` receipt-config endpoint accepts a fully-optional body, effectively behaving like a `PATCH`

**File:** `borderworxWMS/src/application/dto/receipt-config.dto.ts:3-18`, `borderworxWMS/src/interfaces/http/routes/receipt-config.routes.ts:27-33`
**Issue:** `upsertReceiptConfigSchema` marks every field `.optional()`, and this same schema validates the body of `PUT /customers/:customerId/receipt-config`. Semantically, `PUT` implies a full-resource replace; here, an empty `{}` body is valid and will fall back to `?? false`/`?? 0` for a *new* row (`PrismaReceiptConfigRepository.upsert`'s `create` branch) but leave an *existing* row's un-supplied fields untouched (`update` branch only spreads keys that are `!== undefined`). The same endpoint therefore has different semantics depending on whether the row already exists, which is easy to misuse from a future API consumer's perspective.
**Fix:** Either require all fields for the `PUT` (full replace) and add a separate `PATCH` for partial updates, or explicitly document/rename the endpoint's partial-upsert semantics.

### WR-04: Inconsistent `id` field contract between `ReceiptConfig` and `Customer` responses

**File:** `borderworxWMS/src/application/use-cases/receipt-config/get-receipt-config.use-case.ts:11-25`, `borderworxWMS/src/application/dto/receipt-config.dto.ts:27-41`
**Issue:** When no `CustomerReceiptConfig` row exists yet, `GetReceiptConfigUseCase` synthesizes a placeholder entity with `id: ''` rather than using `null`/`undefined`. `ReceiptConfigResponseDto.id` and the frontend's `receiptConfigDTOSchema.id` are typed as plain `z.string()` (not `.uuid()`), unlike `customerDTOSchema.id: z.string().uuid()`, presumably to accommodate this empty-string sentinel. This is a fragile, implicit contract — any future caller that assumes `id` is a real identifier (e.g. for cache keys, links, or optimistic UI) will silently misbehave for customers without a saved receipt config.
**Fix:** Make the "no config yet" case explicit in the type system, e.g. return `ReceiptConfig | null` from the use case (letting the controller build response defaults), or add an explicit `isDefault: boolean` flag to the response DTO.

## Info

### IN-01: Duplicated "default to false" field-mapping logic

**File:** `borderworxWMS/src/infrastructure/repositories/prisma-receipt-config.repository.ts:17-28`, `borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts:60-76`
**Issue:** The exact same "`rc.field ?? false`" (and `?? 0` for the surcharge) mapping for all nine `CustomerReceiptConfig` fields is duplicated between the standalone upsert repository and the inline creation inside `PrismaCustomerRepository.create`'s transaction. Adding a new receipt-config field, or changing a default, requires remembering to update both locations.
**Fix:** Extract a small shared helper (e.g. `buildReceiptConfigCreateData(data: UpsertReceiptConfigData)`) used by both call sites.

### IN-02: Invalid/empty fuel-surcharge input is silently coerced to `0` with no feedback

**File:** `borderworxWMSFrontend/src/modules/customer/lib/receiptConfig.ts:19-24`
**Issue:** `receiptFormValuesToRequest` does `Number(v.fuelSurchargePercentage)` and falls back to `0` via `Number.isFinite(parsed) ? parsed : 0` whenever the value doesn't parse. Combined with WR-02 (no client-side validation in the edit form), a user who clears the field or leaves it in an odd intermediate state during editing will have it silently submitted as `0%` rather than being prompted to fix it.
**Fix:** Surface a validation error instead of silently defaulting, or validate via `receiptConfigRequestSchema` before calling this mapper.

---

_Reviewed: 2026-07-10T13:41:47Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
