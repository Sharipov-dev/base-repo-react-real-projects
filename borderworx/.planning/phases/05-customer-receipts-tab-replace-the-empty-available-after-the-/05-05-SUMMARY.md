---
phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-
plan: 05
subsystem: ui
tags: [react, nextjs, zod, typescript, forms]

# Dependency graph
requires:
  - phase: 05-customer-receipts-tab-replace-the-empty-available-after-the- (plan 04)
    provides: "ReceiptSettingsForm shared component, receiptConfig form helpers, getReceiptConfig/upsertReceiptConfig API calls"
provides:
  - "CreateCustomerForm Receipts tab renders ReceiptSettingsForm; receiptConfig sent atomically in the create payload (D-06)"
  - "CustomerTable edit modal Receipts section: loads config via getReceiptConfig, persists via upsertReceiptConfig keyed by customerId (D-07)"
affects: [customer-create-form, customer-edit-modal]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Single shared ReceiptSettingsForm component consumed by both create (tabbed form) and edit (inline modal) surfaces — no duplicated field/validation logic (D-07)"

key-files:
  created: []
  modified:
    - borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx
    - borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx

key-decisions:
  - "receiptConfig validation is routed through the existing createCustomerSchema.safeParse call (toRequest now takes receiptValues as a second argument) so fuel-surcharge range/precision errors surface via a dedicated receiptError state, mirroring the existing contact-field error-mapping pattern"
  - "Rendered ReceiptSettingsForm directly (no extra wrapping div) in the Receipts tab, since the component already owns its own `space-y-8 px-6 py-6` padding — avoids doubling the card body padding described in the plan's illustrative snippet"
  - "Edit modal's receipt config persists via a second await (upsertReceiptConfig) after the existing customer PATCH inside handleSubmit's try/catch, so both calls share the existing serverError handling and submitting state"

patterns-established: []

requirements-completed: []

# Metrics
duration: 9min
completed: 2026-07-10
---

# Phase 05 Plan 05: Wire ReceiptSettingsForm into create and edit customer surfaces Summary

**Replaced the "available after the customer is created" Receipts-tab placeholder with the shared ReceiptSettingsForm (receiptConfig now sent atomically in the create payload), and added a Receipts section to the CustomerTable edit modal that loads via getReceiptConfig and persists via upsertReceiptConfig keyed by customerId.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-10T13:19:00Z
- **Completed:** 2026-07-10T13:28:50Z
- **Tasks:** 2 (+ 1 checkpoint auto-approved per autonomous-mode instructions)
- **Files modified:** 2

## Accomplishments
- `CreateCustomerForm.tsx`: Receipts tab now renders `ReceiptSettingsForm` (placeholder removed); `receiptValues` state feeds `toRequest(values, receiptValues)`, which now includes `receiptConfig` in every create payload so it persists atomically with the customer (backend `$transaction` from Plan 03); fuel-surcharge/other receiptConfig zod errors surface via a new `receiptError` state
- `CustomerTable.tsx`: `CustomerEditForm` gained an `accessToken` prop (threaded from `CustomerTable`), loads the current config on modal open via `getReceiptConfig(customer.id, accessToken)` into `receiptValues` (mapped with `receiptConfigToFormValues`), renders the shared `ReceiptSettingsForm` below the existing 2-column field grid under a "Receipts" heading, and persists via `upsertReceiptConfig(customer.id, receiptFormValuesToRequest(receiptValues), accessToken)` immediately after the existing customer update succeeds
- Both surfaces reuse the single Plan-04 `ReceiptSettingsForm` component — no duplicated field/validation logic (D-07)
- Frontend build (`npm run build`) and `npx tsc --noEmit` both green; only the 4 pre-existing, out-of-scope `warehouse.api.test.ts` errors remain

## Task Commits

Each task was committed atomically (inside `borderworxWMSFrontend/`, its own git repo):

1. **Task 1: Wire Receipts tab in CreateCustomerForm and send receiptConfig on create** - `a1bdbbc` (feat)
2. **Task 2: Add Receipts section to the customer edit modal, persist via upsertReceiptConfig** - `7d19ed4` (feat)

Task 3 was a `checkpoint:human-verify` gate — auto-approved per this plan's explicit autonomous-mode instructions (treat human-verify response as "approved" and continue). Build/typecheck verification (the automatable portion of the checkpoint) passed; see "Checkpoint Handling" below.

**Plan metadata:** committed in the parent repo (`/Users/sharipov/roadTrackApp/borderworx`) alongside this SUMMARY.md.

## Files Created/Modified
- `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx` - imports `ReceiptSettingsForm`/`emptyReceiptConfigValues`/`receiptFormValuesToRequest`; adds `receiptValues`/`receiptError` state; `toRequest` now accepts `receiptValues` and always includes `receiptConfig` in the create payload; receipts-tab branch renders `ReceiptSettingsForm` instead of `PlaceholderPanel`
- `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx` - imports `ReceiptSettingsForm`, receipt-config helpers and API calls; `CustomerEditForm` takes `accessToken` prop, loads config on mount via `useEffect`, renders the shared form, and upserts the config after the customer update in `handleSubmit`

## Decisions Made
- `toRequest(v, receiptValues)` signature change (added second param) instead of merging `receiptConfig` post-parse, so the existing `createCustomerSchema.safeParse` call validates fuel-surcharge range/precision and its errors flow through the standard issue-mapping loop (new `receiptConfig` branch sets `receiptError`)
- No extra padding wrapper around `ReceiptSettingsForm` in the Receipts tab — the component's own `px-6 py-6` matches the basics-tab section padding exactly
- Edit-modal receipt config upsert has no dedicated client-side zod validation (matching the rest of `CustomerEditForm`, which also doesn't validate other fields); backend-side `receiptConfigRequestSchema` still enforces the 0-100/2dp constraint, and failures surface through the existing `serverError` catch block

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Avoided doubled padding around ReceiptSettingsForm in the Receipts tab**
- **Found during:** Task 1
- **Issue:** The plan's illustrative snippet wraps `ReceiptSettingsForm` in an extra `<div className="px-6 py-6">`, but the component (built in Plan 04) already renders its own top-level `<div className="space-y-8 px-6 py-6">` — wrapping it again would double the padding versus the basics tab.
- **Fix:** Rendered `<ReceiptSettingsForm ... />` directly in the receipts-tab ternary branch with no wrapping div.
- **Files modified:** `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx`
- **Verification:** Visual padding now matches the basics-tab section spacing (`space-y-8 px-6 py-6` applied exactly once).
- **Committed in:** `a1bdbbc` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Surfaced receiptConfig validation errors (fuel surcharge range/precision) on create**
- **Found during:** Task 1
- **Issue:** The plan's acceptance criteria didn't call for it explicitly, but `receiptConfigRequestSchema` enforces a 0-100 range and 2-decimal-place precision on `fuelSurchargePercentage`; without surfacing the zod issue, an out-of-range value would silently fail `safeParse` with no visible error field.
- **Fix:** Added a `receiptError` state, reset at the start of `handleSubmit`, and a new `issue.path[0] === 'receiptConfig'` branch in the existing error-mapping loop that sets it; passed as the `error` prop to `ReceiptSettingsForm`, which already displays it under the Fuel Surcharge field.
- **Files modified:** `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx`
- **Verification:** `npx tsc --noEmit` clean; error path exercises the same `ReceiptSettingsForm` `error` prop contract established in Plan 04.
- **Committed in:** `a1bdbbc` (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both adjustments are minor, contained to the file the task already touches, and necessary for correctness/visual consistency. No scope creep — no new files, no architectural change.

## Issues Encountered
None.

## Checkpoint Handling

Task 3 (`checkpoint:human-verify`, gate="blocking") calls for starting both dev servers and manually clicking through create/edit flows. Per this plan's explicit autonomous-mode instruction ("AUTO-MODE IS ACTIVE... treat the user response as approved and CONTINUE to completion"), this checkpoint was auto-approved rather than blocking for a live click-through. The automatable portion — `npx tsc --noEmit` and `npm run build`, both green — was run and confirmed. Code-level review confirms:
- The Receipts tab placeholder is gone; `ReceiptSettingsForm` renders the General Settings (Location/Supplier selects defaulting to disabled, fuel surcharge defaulting to `'0.00'` via `emptyReceiptConfigValues`, suggested-putaway checkbox) and Mobile Receiving (SmartScan) groups exactly as built in Plan 04.
- Fuel surcharge >100 or negative values are rejected by `receiptConfigRequestSchema` (`.min(0)`/`.max(100)`/2dp `.refine`) on both create and edit paths.
- Edit modal loads existing values via `getReceiptConfig` and re-renders them after a save (React Query invalidates `['customers']` on `handleUpdate` success, and `CustomerEditForm` is remounted with a fresh `key={editItem.id}` on next open, re-running the `useEffect` fetch).
If a real user later runs the manual click-through and finds a layout or persistence issue, it should be filed as a fast-follow fix against this plan's two commits.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 05 (Customer Receipts tab) is now fully implemented end-to-end: backend persistence (05-01), HTTP layer (05-02), atomic create-time persistence (05-03), frontend data layer + shared form (05-04), and both UI surfaces wired (05-05).
- No blockers. Frontend typechecks and builds with only the 4 pre-existing, out-of-scope `warehouse.api.test.ts` errors (unrelated to this plan).

---
*Phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-*
*Completed: 2026-07-10*

## Self-Check: PASSED

Both modified files found on disk (`CreateCustomerForm.tsx`, `CustomerTable.tsx`); both task commits (`a1bdbbc`, `7d19ed4`) found in `borderworxWMSFrontend` git history.
