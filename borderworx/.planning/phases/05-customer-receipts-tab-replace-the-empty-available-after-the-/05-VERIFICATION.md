---
phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-
verified: 2026-07-10T13:36:29Z
status: human_needed
score: 8/8 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Visual layout of the Receipts tab (create form) matches the provided screenshot"
    expected: "GENERAL SETTINGS group with 3-across row (Location Options / Supplier Options / Fuel Surcharge %) + suggested-putaway checkbox below; MOBILE RECEIVING (SMARTSCAN) group with a 2-column, 5-checkbox grid"
    why_human: "Visual/layout fidelity cannot be verified from source alone — code review confirms the correct CSS classes (grid-cols-3, grid-cols-2) and section headers, but actual rendered spacing/alignment against the screenshot needs a human look"
  - test: "Full create -> list -> edit round trip: create a customer with non-default receipt settings (toggle selects, check boxes, set fuel surcharge to 12.50), then open Edit and confirm the same values are shown"
    expected: "Edit modal's Receipts section reflects exactly what was saved at create time (this exercises the atomic $transaction write + the getReceiptConfig read-back together)"
    why_human: "The plan's own Task 3 checkpoint (`checkpoint:human-verify`, gate=blocking) covering this exact flow was auto-approved by the executing agent without a live click-through (see 05-05-SUMMARY.md 'Checkpoint Handling' section) — this has never actually been exercised by a human or an integration test"
  - test: "Fuel surcharge validation UX: enter a value >100 or a negative value on both the create form and the edit modal, submit, and confirm a visible, correctly-placed error message appears (not just a silent failed request)"
    expected: "Error surfaces under the Fuel Surcharge field via the `error` prop on both surfaces; request is rejected by the zod schema (0-100 range, 2dp) on both client and server"
    why_human: "Validation logic is present in code (grep-confirmed on both frontend `receiptConfigRequestSchema` and backend `upsertReceiptConfigSchema`), but the actual UX (whether the message renders legibly, whether the edit modal's lack of a dedicated client-side validator surfaces the server 400 cleanly) needs a human click-through — the SUMMARY explicitly notes the edit modal has no client-side zod validation and relies on the `serverError` catch block"
  - test: "Edit modal loads a real (non-default) saved config for an existing customer, not just the all-false defaults"
    expected: "Opening Edit on a customer that already has a saved receipt config population fields with the actual saved values (not always the empty/default state)"
    why_human: "Confirmed via code review that `getReceiptConfig` is called with `customer.id`/`accessToken` in a `useEffect` and mapped via `receiptConfigToFormValues`, and that `key={editItem.id}` forces a remount per customer — but this has not been exercised against live data by a human"
---

# Phase 5: Customer Receipts tab Verification Report

**Phase Goal:** Customers can configure receipt settings (Location/Supplier enabled toggles, Fuel Surcharge %, suggested putaway, and Mobile Receiving/SmartScan options) on the Receipts tab during BOTH create and edit, persisted per customer in a dedicated CustomerReceiptConfig table.

**Verified:** 2026-07-10T13:36:29Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A `CustomerReceiptConfig` table exists, 1:1 with Customer, cascade-deleted (D-05) | VERIFIED | `schema.prisma` model confirmed (`customerId @unique`, `onDelete: Cascade`, `@@map("customer_receipt_configs")`); live DB query against `information_schema.columns` on `localhost:5434` confirmed all 13 columns present in the actual Postgres instance; `prisma.customerReceiptConfig` delegate confirmed present at runtime |
| 2 | Booleans default false, fuel surcharge is Decimal(5,2) default 0, validated 0-100/2dp (D-01–D-04) | VERIFIED | Schema shows `Decimal @default(0) @db.Decimal(5,2)`; 8 boolean fields `@default(false)`; both backend (`upsertReceiptConfigSchema`) and frontend (`receiptConfigRequestSchema`) enforce `.min(0).max(100)` + 2dp `.refine` |
| 3 | Reads never 404 — GET always returns a defaulted config (D-06) | VERIFIED | `GetReceiptConfigUseCase.execute` returns synthesized all-defaults object when `findByCustomerId` returns null; controller `get()` has no null branch (grep-confirmed absence of `? toReceiptConfigResponse`) |
| 4 | GET/PUT `/api/customers/:customerId/receipt-config` mounted, permission-gated, DI-wired | VERIFIED | `router.ts` mounts at the exact path; routes gated by `customers.read`/`customers.update`; `container.ts` wires repo → use-cases → controller → exported in `controllers` object; live curl against running backend (port 3000) returned `HTTP 401 UNAUTHORIZED` (not 404), confirming the route exists and auth middleware runs before the handler |
| 5 | Receipt config persists atomically with customer at create time in ONE `$transaction` (D-06) | VERIFIED | `PrismaCustomerRepository.create` wraps `tx.customer.create` + optional `tx.customerContact.create` + optional `tx.customerReceiptConfig.create` in a single `prisma.$transaction`; `CreateCustomerUseCase`/`customer.controller.ts` confirmed untouched (pass-through preserved per Phase 4 precedent); primary-contact logic still present and untouched alongside the new block |
| 6 | Single shared `ReceiptSettingsForm` reused by both CreateCustomerForm and CustomerTable edit modal, no duplicated form body (D-07) | VERIFIED | Both files import `{ ReceiptSettingsForm } from './ReceiptSettingsForm'`; only one component file exists containing the field markup; `CreateCustomerForm.tsx` renders it directly in the `receipts` tab branch; `CustomerTable.tsx`'s `CustomerEditForm` renders it below the existing field grid under a "Receipts" heading |
| 7 | Receipts tab in `CreateCustomerForm` renders the form, not the placeholder | VERIFIED | `tab === 'receipts'` branch renders `<ReceiptSettingsForm .../>` directly; the `"This section will be available after the customer is created."` placeholder text still exists in the file but is only reachable for the remaining `orders`/`system` tabs (confirmed via the `tabs` array and the ternary fallthrough) — correctly out of scope per the phase context |
| 8 | Backend and frontend typecheck clean, no new errors introduced | VERIFIED | `cd borderworxWMS && npm run typecheck` → zero errors; `cd borderworxWMSFrontend && npx tsc --noEmit` → only the 4 pre-existing, out-of-scope `warehouse.api.test.ts` errors (unrelated `organization_id`/`created_at`/`postal_code` snake_case test fixture mismatches, present before this phase) |

**Score:** 8/8 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `borderworxWMS/prisma/schema.prisma` | `CustomerReceiptConfig` model + back-relation | VERIFIED | Model present, back-relation present, pushed to live DB |
| `borderworxWMS/src/domain/entities/receipt-config.entity.ts` | `ReceiptConfig` + `UpsertReceiptConfigData` | VERIFIED | Both interfaces present, all 9 fields |
| `borderworxWMS/src/application/dto/receipt-config.dto.ts` | Zod schemas + response DTO | VERIFIED | `upsertReceiptConfigSchema`, `receiptConfigParamSchema`, `ReceiptConfigResponseDto` all present with range/precision validation |
| `borderworxWMS/src/infrastructure/repositories/prisma-receipt-config.repository.ts` | upsert-by-customerId + findByCustomerId | VERIFIED | Both methods present, correct default handling |
| `borderworxWMS/src/interfaces/http/controllers/receipt-config.controller.ts` | get/upsert handlers + shaper | VERIFIED | `toReceiptConfigResponse` present, no null branch on get |
| `borderworxWMS/src/interfaces/http/routes/receipt-config.routes.ts` | GET/PUT routes | VERIFIED | `mergeParams: true`, both permission gates present |
| `borderworxWMS/src/main/container.ts` | DI wiring | VERIFIED | Repo/use-cases/controller instantiated and exported |
| `borderworxWMS/src/infrastructure/repositories/prisma-customer.repository.ts` | atomic create with receiptConfig | VERIFIED | Single `$transaction`, conditional `tx.customerReceiptConfig.create` |
| `borderworxWMSFrontend/src/modules/customer/ui/ReceiptSettingsForm.tsx` | shared presentational form | VERIFIED | Both groups render per screenshot spec, fully controlled (no `useState`) |
| `borderworxWMSFrontend/src/modules/customer/api/customer.api.ts` | getReceiptConfig/upsertReceiptConfig | VERIFIED | Both functions present, correct URL/method |
| `borderworxWMSFrontend/src/modules/customer/lib/receiptConfig.ts` | defaults + converters | VERIFIED | `emptyReceiptConfigValues`, `receiptConfigToFormValues`, `receiptFormValuesToRequest` all present |
| `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx` | Receipts tab wired | VERIFIED | Imports form, sends `receiptConfig` in create payload via `toRequest(v, receiptValues)` |
| `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx` | edit modal Receipts section | VERIFIED | Loads via `getReceiptConfig`, persists via `upsertReceiptConfig(customer.id, ...)` after customer update |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `prisma-receipt-config.repository.ts` | `prisma.customerReceiptConfig` | generated client | WIRED | `findUnique`/`upsert` calls confirmed; live DB query confirmed delegate + table present |
| `get-receipt-config.use-case.ts` | defaulted `ReceiptConfig` | non-null return | WIRED | Returns synthesized defaults, verified by code + controller's non-null-branch handling |
| `router.ts` | `/customers/:customerId/receipt-config` | `router.use` mount | WIRED | Confirmed in file; live curl against running backend returned 401 (route exists, auth required) not 404 |
| `container.ts` | `receiptConfigController` | controllers export object | WIRED | Present in export object, `grep -c` returns ≥2 |
| `prisma-customer.repository.ts` | `prisma.$transaction` | customer+contact+receiptConfig one tx | WIRED | Single transaction wraps all three optional/required writes |
| `customer.dto.ts` | `upsertReceiptConfigSchema` | import | WIRED | Import present, field added only to `createCustomerSchema` (not `updateCustomerSchema`) |
| `customer.api.ts` (frontend) | `/api/customers/:id/receipt-config` | `backendFetch` GET+PUT | WIRED | Both calls present, Zod-parsed, mapped |
| `CreateCustomerForm.tsx` | `createCustomer` payload.receiptConfig | `receiptFormValuesToRequest` | WIRED | `toRequest(values, receiptValues)` includes `receiptConfig:` key |
| `CustomerTable.tsx` | `upsertReceiptConfig(customerId, ...)` | edit save handler | WIRED | Called immediately after the existing customer update inside `handleSubmit`'s try block |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ReceiptSettingsForm` (create) | `receiptValues` (CreateCustomerForm state) | `useState(emptyReceiptConfigValues)`, updated via `onChange`, sent via `receiptFormValuesToRequest` in create payload | Yes — flows into the real `$transaction` write, confirmed via `prisma-customer.repository.ts` | FLOWING |
| `ReceiptSettingsForm` (edit) | `receiptValues` (CustomerEditForm state) | `useEffect` → `getReceiptConfig(customer.id, accessToken)` → `receiptConfigToFormValues` — a real GET against the live backend/DB | Yes — not hardcoded; live curl confirmed the route requires auth and reaches the controller | FLOWING |
| GET `/receipt-config` | `config` | `GetReceiptConfigUseCase` → `ReceiptConfigRepository.findByCustomerId` → live Postgres `customer_receipt_configs` table | Yes — confirmed table exists with correct columns in the running dev Postgres instance | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend typecheck | `cd borderworxWMS && npm run typecheck` | zero errors | PASS |
| Frontend typecheck | `cd borderworxWMSFrontend && npx tsc --noEmit` | only the 4 known pre-existing `warehouse.api.test.ts` errors, no new errors | PASS |
| Live DB schema check | `information_schema.columns` query for `customer_receipt_configs` | all 13 expected columns present | PASS |
| Live route mount check | `curl http://localhost:3000/api/customers/{uuid}/receipt-config` | `HTTP 401 UNAUTHORIZED` (route exists, auth enforced, not a 404) | PASS |
| Anti-pattern scan | grep TODO/FIXME/PLACEHOLDER/stub patterns across all 16 phase-touched files | no matches | PASS |

### Requirements Coverage

Not applicable — this is a decision-derived phase (no REQUIREMENTS.md entries). Verified against the phase goal and the 5 plan/summary pairs' `must_haves` instead (see Observable Truths above).

### Anti-Patterns Found

None. No TODO/FIXME/PLACEHOLDER/stub markers, no empty handlers, no hardcoded-empty data flowing to render in any of the 16 files touched across this phase's 5 plans.

### Human Verification Required

### 1. Visual layout matches the screenshot

**Test:** Open Create Customer → Receipts tab in a browser.
**Expected:** Two labeled groups exactly as in the screenshot — GENERAL SETTINGS (3-across: Location Options / Supplier Options / Fuel Surcharge %, then suggested-putaway checkbox) and MOBILE RECEIVING (SMARTSCAN) (2-column, 5-checkbox grid).
**Why human:** Code review confirms the correct Tailwind grid classes and field bindings, but actual visual fidelity against a screenshot requires human eyes.

### 2. Full create → edit round trip persistence

**Test:** Create a customer with non-default receipt settings (e.g., enable locations, enable suppliers, fuel surcharge 12.50, check a few boxes). Open Edit on that customer immediately after.
**Expected:** The edit modal's Receipts section shows exactly the values just saved, not defaults.
**Why human:** This exact flow is the plan's own `checkpoint:human-verify` (gate="blocking") task, which was auto-approved by the executing agent without a live click-through per its "autonomous mode" instructions (see 05-05-SUMMARY.md, "Checkpoint Handling" section). It has never actually been exercised end-to-end by a human or an automated integration test — only unit-level code review and typechecking occurred.

### 3. Fuel surcharge validation UX

**Test:** On both the create form and the edit modal, enter a fuel surcharge >100 or a negative number, then submit.
**Expected:** A visible error message appears near the Fuel Surcharge field (not a silent failure or an unhandled exception).
**Why human:** Validation schemas exist on both client and server, but the edit modal has no dedicated client-side Zod validation per the plan's own SUMMARY notes — it relies entirely on the `serverError` catch block, which needs a human to confirm renders acceptably.

### 4. Edit modal loads real saved data (not just defaults) for an existing customer

**Test:** Pick a customer known to have previously saved, non-default receipt settings and open Edit.
**Expected:** Fields populate with the actual saved values via the `getReceiptConfig` fetch, not the all-false/all-default state.
**Why human:** Code confirms the `useEffect`/`getReceiptConfig`/`key={editItem.id}` wiring is correct, but this needs to be exercised against real persisted data by a human to close the loop the auto-approved checkpoint left open.

### Gaps Summary

No code-level gaps were found — every backend layer (Prisma model → domain → DTO → repository → use-cases → controller → routes → DI wiring → atomic create transaction) and every frontend layer (types → schema → mapper → API → shared form → both create and edit surfaces) was traced and confirmed present, substantive, and wired, including a live check against the running dev backend/Postgres instance. Both `npm run typecheck` (backend) and `npx tsc --noEmit` (frontend) are clean apart from the 4 known pre-existing, unrelated test-fixture errors.

The reason this phase is `human_needed` rather than `passed` is that Plan 05's own blocking human-verification checkpoint (Task 3: "Verify Receipts form on create and edit — visual + functional") was never actually executed against a running UI. The executing agent auto-approved it under an autonomous-mode instruction and substituted a code review in its place. Static analysis and a live backend route probe are strong evidence the feature is wired correctly, but the actual user-facing behavior (visual fidelity to the screenshot, the create→edit round trip with real data, and validation-error UX) has not been confirmed by any human or by an integration test. This is exactly the kind of gap the phase's own plan anticipated and gated on — it should not be silently waved through a second time.

---

*Verified: 2026-07-10T13:36:29Z*
*Verifier: Claude (gsd-verifier)*
