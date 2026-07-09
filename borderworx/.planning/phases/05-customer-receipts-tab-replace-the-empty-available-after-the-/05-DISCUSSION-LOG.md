# Phase 5: Customer Receipts tab — receipt configuration form - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 05-customer-receipts-tab-replace-the-empty-available-after-the-
**Areas discussed:** Select options & defaults

---

## Area selection (which gray areas to discuss)

| Option | Description | Selected |
|--------|-------------|----------|
| Persistence shape | Separate 1:1 config table vs. columns on Customer | |
| Create-time save flow | Atomic-with-customer vs. default-then-save | |
| Edit surface | Tabs / collapsible section / drawer on the flat edit modal | |
| Select options & defaults | Toggle vs. enum selects; default values | ✓ |

**User's choice:** Select options & defaults (others accepted at annotated defaults).
**Notes:** Persistence → separate `CustomerReceiptConfig` table (mirror `CustomerPackingSlipConfig`); Create-time → atomic `$transaction` with customer; Edit → surface receipt settings on the edit path (shared component preferred).

---

## Select options & defaults

### Dropdown values (Location Options / Supplier Options)

| Option | Description | Selected |
|--------|-------------|----------|
| Just enabled / disabled | Two-value toggle per dropdown, stored as boolean | ✓ |
| Disabled + optional + required | Three-tier enum per dropdown | |
| I'll list the exact options | User provides custom option sets | |

**User's choice:** Just enabled / disabled.
**Notes:** Both dropdowns are enabled/disabled toggles → booleans (`locationsEnabled`, `suppliersEnabled`), default disabled, rendered as 2-option selects.

### Fuel Surcharge Percentage behavior

| Option | Description | Selected |
|--------|-------------|----------|
| 0–100, 2 decimals | Clamped 0–100, 2 dp, default 0.00, rejects negatives/>100 | ✓ |
| ≥0, 2 decimals, no upper cap | Non-negative, 2 dp, no 100 ceiling | |
| Plain optional number | Nullable numeric, minimal validation | |

**User's choice:** 0–100, 2 decimals.
**Notes:** Decimal storage to preserve 2-dp precision; default 0.00.

---

## Claude's Discretion

- **Persistence shape** — separate 1:1 `CustomerReceiptConfig` table mirroring `CustomerPackingSlipConfig` (own DTO/entity/repo/mapper/use-cases/controller/routes; cascade delete). No columns on Customer.
- **Create-time save flow** — persist config atomically with customer create via Prisma `$transaction`; reads always return a defaulted config.
- **Edit surface** — expose receipt settings on the edit path, preferably via a shared form component reused by both the create Receipts tab and the `CustomerTable` edit modal; persist via the config `upsert` endpoint keyed by `customerId`.
- All six Mobile Receiving checkboxes default OFF.

## Deferred Ideas

- Enforcing receipt settings in the actual receiving/putaway/ASN flows (this phase only captures & persists config).
- Multi-tier Location/Supplier options (disabled/optional/required) — rejected in favor of a simple toggle.
