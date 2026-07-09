# Phase 5: Customer Receipts tab — receipt configuration form - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the empty Receipts-tab placeholder ("This section will be available after the customer is created.") on the customer form with the **receipt configuration form**, matching the provided screenshot, persisted per customer, and available during **both create and edit**.

The form renders two groups:
- **General Settings:** Location Options (select), Supplier Options (select), Fuel Surcharge Percentage (number), Enable suggested putaway (checkbox).
- **Mobile Receiving / SmartScan:** Receive against ASN, Default quantity = 1, Allow move of unconfirmed inventory, Use blind receipts, Display Weight field for receipts (all checkboxes).

**In scope:**
- Backend: persist these receipt settings per customer (new config table + full-stack CRUD/upsert path).
- Frontend: build the Receipts-tab form section in `CreateCustomerForm.tsx`, and expose the same settings on the customer edit path.

**Out of scope (no scope creep):**
- Actually enforcing any of these settings in the receiving/putaway/ASN flows (this phase only captures & persists configuration; downstream receiving behavior is unchanged).
- The Orders / Batches / System tabs (still placeholders — separate phases).

</domain>

<decisions>
## Implementation Decisions

### Select options & defaults (discussed)
- **D-01:** **Location Options** is an **enabled / disabled** toggle only — stored as a boolean (`locationsEnabled`), rendered as a 2-option dropdown ("Locations disabled" / "Locations enabled"). **Default: disabled (false)**, matching the screenshot. Not a multi-tier enum.
- **D-02:** **Supplier Options** is an **enabled / disabled** toggle only — stored as a boolean (`suppliersEnabled`), rendered as a 2-option dropdown ("Suppliers disabled" / "Suppliers enabled"). **Default: disabled (false)**.
- **D-03:** **Fuel Surcharge Percentage** — decimal, validated **0–100 inclusive, up to 2 decimal places** (e.g. `12.50`); rejects negatives and values >100. **Default: `0.00`**. Store as a decimal type (not a bare int/float — use Prisma `Decimal`/appropriate numeric to preserve 2-dp precision).
- **D-04:** **All six checkboxes default OFF (false):** `enableSuggestedPutaway`, `receiveAgainstAsn`, `defaultQuantityOne`, `allowMoveUnconfirmedInventory`, `useBlindReceipts`, `displayWeightField`. (Field names are suggestions; planner may finalize casing/mapping.)

### Persistence shape (Claude's Discretion — default accepted)
- **D-05:** Persist receipt settings in a **new separate 1:1 `CustomerReceiptConfig` table**, mirroring the existing `CustomerPackingSlipConfig` precedent exactly: `customerId @unique`, `onDelete: Cascade`, its own DTO/entity/domain-repo-interface/Prisma-repo/mapper, `get` + `upsert` use-cases keyed by `customerId`, and controller/routes. **Do NOT add columns to the `Customer` model.** This keeps receipt config isolated and consistent with the packing-slip config pattern.

### Create-time save flow (Claude's Discretion — default accepted)
- **D-06:** Receipt settings must be editable **at customer-create time** (Receipts tab of `CreateCustomerForm`). When receipt settings are present in the create payload, persist the config **atomically with the customer** inside a single Prisma `$transaction` (follow the Phase 4 primary-contact precedent). If the create payload carries no receipt settings, create the customer normally; the config is created with defaults (either eagerly with defaults or lazily on first `upsert` — planner's call, but reads must always return a defaulted config, never a hard 404 the UI can't handle).

### Edit surface (Claude's Discretion — default accepted)
- **D-07:** Expose the same receipt-settings form on the **customer edit path**. Today the edit flow is a **flat inline modal in `CustomerTable.tsx`** (2-column `EField`/`EInput` grid), NOT the tabbed create form. Bring the Receipts section to edit — preferably by extracting the Receipts form body into a **shared component reused by both** the create form's Receipts tab and the edit modal — and persist changes via the config **`upsert` endpoint keyed by `customerId`**. Adding a tabbed layout to the edit modal is acceptable but secondary to avoiding UI duplication.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs govern this phase. The authoritative patterns to read and mirror are the existing `CustomerPackingSlipConfig` full-stack config feature and the Phase 4 atomic-create precedent.

### Persistence precedent — MIRROR this feature for CustomerReceiptConfig
- `borderworxWMS/prisma/schema.prisma` — `Customer` model (L149) and `CustomerPackingSlipConfig` model (L179); add a new `CustomerReceiptConfig` model + back-relation on `Customer`
- `borderworxWMS/src/application/dto/packing-slip-config.dto.ts` — upsert/param Zod schemas + response DTO shape
- `borderworxWMS/src/domain/entities/packing-slip-config.entity.ts` — entity + `Upsert...Data` shape
- `borderworxWMS/src/domain/repositories/packing-slip-config.repository.ts` — repository interface (`findByCustomerId`, `upsert`)
- `borderworxWMS/src/infrastructure/repositories/prisma-packing-slip-config.repository.ts` — Prisma `upsert`-by-`customerId` impl
- `borderworxWMS/src/infrastructure/repositories/packing-slip-config.mapper.ts` — Prisma→domain mapper
- `borderworxWMS/src/application/use-cases/packing-slip-config/get-packing-slip-config.use-case.ts`
- `borderworxWMS/src/application/use-cases/packing-slip-config/upsert-packing-slip-config.use-case.ts`
- `borderworxWMS/src/interfaces/http/controllers/packing-slip-config.controller.ts`
- `borderworxWMS/src/interfaces/http/routes/packing-slip-config.routes.ts`
- `borderworxWMS/src/main/container.ts` — DI wiring for the new repo + use-cases + controller

### Customer create path — for atomic create-time persistence (D-06)
- `borderworxWMS/src/application/use-cases/customer/create-customer.use-case.ts` — the seam where customer + receipt-config inserts are coordinated
- `borderworxWMS/src/application/dto/customer.dto.ts` — `createCustomerSchema` (extend with optional receipt-settings payload)
- `borderworxWMS/src/interfaces/http/controllers/customer.controller.ts` — create endpoint wiring

### Transaction precedent (atomicity pattern)
- `borderworxWMS/src/application/use-cases/order/advance-order-status.use-case.ts` — `$transaction` in a use-case
- `borderworxWMS/src/infrastructure/repositories/prisma-receipt.repository.ts` — `$transaction` in a repository

### Frontend — form surfaces to build/extend
- `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx` — Receipts tab currently renders `<PlaceholderPanel>` (see `tab === 'receipts'` branch ~L272 and `PlaceholderPanel` ~L279); replace with the receipt-settings form
- `borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx` — flat inline **edit modal** (~L366–410); add the shared receipt-settings section here (D-07)
- `borderworxWMSFrontend/src/modules/customer/model/schema.ts` — create/edit form schema (mirror backend receipt fields)
- `borderworxWMSFrontend/src/modules/customer/model/types.ts` — form value types
- `borderworxWMSFrontend/src/modules/customer/api/customer.api.ts` — customer API; add receipt-config get/upsert calls

### Scaffolding skills (optional accelerators)
- `borderworxWMS/.claude/skills` — `create-table` (scaffold the new Prisma model/entity) and `implement-crud` (scaffold repo/DTO/use-cases/controller/routes for the new entity)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`CustomerPackingSlipConfig` feature (full-stack):** a complete, working 1:1 customer-config feature — DTO, entity, domain repo interface, Prisma `upsert`-by-`customerId` repo, mapper, `get`/`upsert` use-cases, controller, routes. `CustomerReceiptConfig` should be a near-copy with receipt fields.
- **Prisma `$transaction`:** established across receipt/inventory/role/putaway repos and used in Phase 4's customer+primary-contact create — atomic multi-write is a solved pattern.
- **`CreateCustomerForm.tsx` tabbed layout:** already has the `receipts` tab wired; only the panel body needs building.
- **`EField`/`EInput` primitives in `CustomerTable.tsx`:** the edit modal's field components to reuse for edit-side receipt inputs.

### Established Patterns
- **Clean/hexagonal layering** (per `borderworxWMS/CLAUDE.md`): DTO (Zod) → use-case (one operation per class) → domain repo interface → Prisma repo (+ mapper). Config-config logic belongs in a use-case, not the controller.
- **Config is keyed by `customerId` (1:1, cascade delete):** reads should return a defaulted config so the UI always has values to render, even before first save.
- **Checkboxes/toggles map to booleans; fuel surcharge to a 2-dp decimal** (D-01–D-04) — no migration gymnastics, straightforward column types.

### Integration Points
- **Backend create seam:** `CreateCustomerUseCase.execute` coordinates the customer insert and the optional receipt-config insert in one `$transaction`.
- **Edit seam:** the config `upsert` endpoint (keyed by `customerId`) is called from the `CustomerTable` edit modal.
- **Shared frontend component:** a single Receipts-settings form body consumed by both the create form's Receipts tab and the edit modal avoids duplicating field/validation logic.

</code_context>

<specifics>
## Specific Ideas

- The **provided screenshot is the visual target**: two labeled groups ("GENERAL SETTINGS" and "MOBILE RECEIVING (SMARTSCAN)"), the three-across General Settings row (Location Options / Supplier Options / Fuel Surcharge %), "Enable suggested putaway" below, and the two-column checkbox grid for Mobile Receiving. Match this layout.
- The selects display "Locations disabled" / "Suppliers disabled" as the default (disabled) label — confirmed as enabled/disabled toggles (D-01/D-02).

</specifics>

<deferred>
## Deferred Ideas

- **Enforcing receipt settings in receiving/putaway/ASN flows** — this phase only captures & persists config. Making `receiveAgainstAsn`, blind receipts, suggested putaway, unconfirmed-inventory moves, etc. actually change receiving behavior is future work (their own phases).
- **Multi-tier Location/Supplier options** (e.g. disabled/optional/required) — explicitly rejected in favor of a simple enabled/disabled toggle (D-01/D-02); revisit only if the receiving flows later need finer control.

</deferred>

---

*Phase: 05-customer-receipts-tab-replace-the-empty-available-after-the-*
*Context gathered: 2026-07-09*
