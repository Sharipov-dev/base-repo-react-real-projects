# BorderworxWMS — Backlog

Missing logic, incomplete workflows, and known gaps across the system.
Items are labelled **[HIGH]**, **[MEDIUM]**, or **[LOW]** and roughly ordered by importance within each section.
Completed items are marked ✅.

---

## Recently Completed

- ✅ **Putaway location filtering** — `GET /api/locations` now supports `warehouseId`, `locationType`, and `isActive` query filters; frontend putaway form fetches only storage locations for the correct warehouse.
- ✅ **Putaway capacity enforcement** — completing a putaway task now checks location capacity inside the transaction and throws `LocationCapacityExceededError` if the location would be overfilled.
- ✅ **Backend error message propagation** — `BackendError.fromResponse()` now reads `error.message` from the backend envelope so real error messages surface in the frontend instead of "Backend error: 400".
- ✅ **Negative stock guard** — `adjust-inventory` rejects adjustments that would push quantity below zero.
- ✅ **Over-receipt guard** — `receive-against-receipt` rejects quantities that exceed what was expected per item.
- ✅ **Order state machine enforcement** — `advance-order-status` validates transitions against an allowlist and throws a typed `OrderInvalidTransitionError` on invalid moves.
- ✅ **Auto-deallocate on order cancellation** — transitioning an order to `cancelled` now releases all reserved inventory in the same transaction.
- ✅ **Order allocation engine** — orders are created *unallocated* (an order must be capturable even with an empty warehouse). Allocation is a deliberate action: FEFO-then-FIFO sourcing, partial allocation, split-to-backorder, short-ship, unallocate. `order_allocations` records which inventory backs each line, so releases and shipments always know what to give back. **Supersedes the old auto-reserve-on-create behaviour, which deleted the order when stock was short.**
- ✅ **Return → inventory restock** — archiving a return now upserts inventory and creates `InventoryTransaction` records for all good-condition items, placed at the warehouse's first active receiving/storage location.
- ✅ **Picking list location ordering** — `findForPicking` now appends zone → aisle → bay → level → position as a secondary sort after the item's FIFO/FEFO/LIFO valuation order.

---

## Billing v2 — open questions (2026-10-15)

Shipped on 2026-10-15: multi-currency rates/charges with FX conversion on billing day (ECB rate + configurable markup, default 1.435%), our-cost / vendor-cost on rates and charges, first-unit vs additional-unit pricing, per-order and per-period storage minimums (top-up charges), free-storage windows, container / pallet / carton / floor-loaded / drayage / palletizing receiving charges, warehouse-scoped custom charges (US / CA), manual charge entry, auto-billing when an order ships or a receipt completes, weekly / biweekly / monthly billing cycle with customs on a separate invoice, and the minimum-vs-transactional profitability report.

- **[HIGH] Export template** — the client's spreadsheet example has not been provided yet. Charges, invoices and the profitability report export CSV / Excel with the current headers; map them to the template once it arrives (`BillingDashboard` DataTable export, `ProfitabilityReportScreen` `EXPORT_HEADERS`).
- **[HIGH] "Google rate"** — Google publishes no FX API. The system uses the European Central Bank daily fix via api.frankfurter.app, which tracks Google's displayed rate within a few basis points, and stores a manual override per day under Billing → Settings. Confirm this is acceptable or name a paid feed.
- **[MEDIUM] Redesign of traffic (freight) and storage quoting** — the requirement is one line. Shipped: freight / accessorial / fuel-surcharge charge codes with our-cost and vendor-cost, entered via "Add charge". A quoting workflow (quote → accept → charge) is not built; needs a discussion of what a quote looks like to the client.
- **[MEDIUM] Receiving photos** — receipts and lines store photo URLs; there is no upload endpoint or object storage. Decide on storage (S3 / Supabase Storage) and the mobile capture flow.
- **[MEDIUM] Billing-cycle scheduler** — `POST /api/billing/cycles/run` must be triggered (button on Invoices, or a cron hitting it with a service token). No scheduler runs it automatically yet.
- **[LOW] Multi-currency summary** — dashboard totals are summed as entered; mixed-currency ledgers are shown per currency rather than converted.
- **[LOW] Warehouse-specific rate lines in the UI** — the rate card picker edits the client-wide card; warehouse-pinned and CUSTOM-type rate lines are supported by the API (`POST /api/billing/rates` with `warehouseId` / `customChargeTypeId`) but have no dedicated screen yet.
- **No A/R** — confirmed out of scope; invoices track paid / unpaid status only.

---

## Inventory

- **[MEDIUM] Blind cycle counting** — the cycle count form currently shows the system quantity to the counter, which introduces bias. The physical count should be entered before revealing what the system expects.
- **[MEDIUM] Reserve / Deallocate UI** — these operations have backend endpoints but no frontend pages. They need to be surfaced in the order detail page or as standalone inventory action forms.
- **[MEDIUM] Expiry-date alerts** — no mechanism to surface inventory records approaching or past their `expiryDate`. Needs a background query and a UI alert, similar to the existing low-stock page.
- **[LOW] Adjustment authorization gates** — large adjustments (configurable threshold, e.g. ±50 units) should require a supervisor to approve before the adjustment is committed.
- **[LOW] Reason codes** — replace free-text reason field with a predefined enum (`DAMAGE`, `THEFT`, `RECEIVING_ERROR`, `EXPIRED`, `CYCLE_COUNT_VARIANCE`, `DATA_CORRECTION`). Free text becomes an optional notes field alongside the code.
- **[LOW] Location freeze during count/adjustment** — while a cycle count or adjustment is in progress for a location, that location should be locked to prevent concurrent picks, puts, or moves from invalidating the count.

---

## Orders & Fulfillment

- **[MEDIUM] Reserve / Deallocate frontend pages** — see Inventory section above; closely tied to the order detail workflow.
- ✅ **Partial fulfillment** — partial allocation, split-to-backorder, and short-ship (writes off the shortfall, keeping the line for audit).
- ✅ **Packing / carton tracking** — `OrderPackage` with process / recalculate / consolidate, first-fit to a 50 lb ceiling using item weights.
- **[LOW] Shipping label integration** — `trackingNumber` and `carrier` are stored but there is no integration with a carrier API (EasyPost, ShipStation, etc.) to generate labels.

---

## Receipts & Purchase Orders

- **[MEDIUM] PO → Receipt linkage** — purchase orders and receipts have no enforced relationship. Receiving against a PO should auto-populate the receipt and mark PO lines as received when fully received.
- **[LOW] Receipt discrepancy workflow** — if physical receipt differs from expected quantities there is no formal discrepancy document or approval step.

---

## Returns

- **[MEDIUM] Return detail page** — returns have a list view only; there is no detail or edit page. Operators cannot update status, record arrival date, or inspect items from the UI.
- **[MEDIUM] Return inspection workflow** — returned items should go through an inspection step that decides disposition per item: restock, quarantine, or write-off. Currently all good-condition items are restocked on archive with no intermediate step.
- **[LOW] Return reason codes** — no structured reason codes (`WRONG_ITEM`, `DAMAGED_IN_TRANSIT`, `CUSTOMER_CHANGED_MIND`, etc.). These drive downstream disposition decisions.

---

## Authorization & Access Control

- ✅ **Role enforcement on endpoints** — `requirePermission` loads the caller's auth context and throws `ForbiddenError` on a missing permission. Wired across every route.
- ✅ **Warehouse-scoped access** — writes go through `requireWarehouseScope`; reads are narrowed by `narrowFiltersToScope` (list) and `requireResourceScope` (by-id, 404 not 403 so callers cannot probe for other tenants' records). Covers orders, receipts, returns, purchase orders and locations.
- **[HIGH] Action audit log** — the `AuditLog` model exists in the schema but **nothing in `src/` ever writes to it**. Dead table: you cannot currently answer "who cancelled this order?"

---

## Dashboard & Reporting

- **[MEDIUM] Date-range filtering** — all reports (summary, transactions, low-stock) return current state only. `createdAfter` / `createdBefore` query params needed for meaningful time-based reporting.
- **[MEDIUM] Dashboard stats incomplete** — missing: orders by status breakdown, receipts pending processing, returns awaiting inspection, inventory value by warehouse.
- **[LOW] Export to CSV** — done client-side on orders (CSV + XLSX, honours active filters). Other tables still lack it; a server-side streaming route is the scalable answer for large exports.

---

## Frontend / UX

- **[MEDIUM] Global toast/notification system** — success and error states are handled inline per form. A shared `useToast` hook wired to a provider in `app/providers.tsx` would give consistent feedback across all operations.
- **[MEDIUM] Confirmation dialogs on destructive actions** — deleting customers, orders, items, or locations fires immediately. A single shared `ConfirmDialog` component should wrap all delete triggers.
- **[LOW] InventoryTable row detail view** — clicking a row should open a detail panel showing lot number, serial number, received date, and a mini transaction history.
- **[LOW] Empty states on all pages** — most pages show a generic "No records found". Contextual empty states with a CTA (e.g. "No items yet — Create your first item") improve onboarding.
- **[LOW] Mobile / tablet layout** — the sidebar and data tables are not usable on small screens. Relevant if warehouse floor devices (tablets, handheld scanners) are in scope.

---

## Known Hazards (found during the order-engine audit)

- **[HIGH] Two systems own `inventory.allocated_quantity`** — the order allocation engine writes it via `order_allocations`, and `POST /api/inventory/reserve` increments it directly with no allocation row. Neither can see the other's reservations, so `scripts/check-inventory-integrity.ts` cannot safely auto-repair drift. Consolidate on one mechanism.
- **[HIGH] No CI** — `.github/workflows` is empty while 11 frontend tests and 1 backend test fail and the backend reports ~615 lint errors. Nothing prevents a regression landing.
- **[MEDIUM] No DB-level inventory constraints** — negative quantity/allocated/available is prevented in application code only. A `CHECK` constraint would be the backstop.
- **[MEDIUM] Frontend test drift** — `warehouse.api.test.ts` and `location-bulk-map.api.test.ts` assert snake_case DTO fields that are now camelCase.

Run `npm run check:inventory` to verify allocation integrity; add `--fix` to reclaim reservations orphaned by deleted orders.

---

## Infrastructure & Operations

- **[MEDIUM] Soft deletes** — most entities use hard deletes. Warehouse data (orders, receipts, inventory records) should be soft-deleted to preserve audit history. Requires adding `deletedAt` to key Prisma models and filtering it everywhere.
- **[LOW] Background job runner** — low-stock checks, expiry alerts, and scheduled reports need a job runner (cron/queue). BullMQ or `node-cron` are the natural choices.
- **[LOW] Rate limiting** — no rate limiting on any API endpoints.
- **[LOW] Webhooks / event bus** — no outbound event system for integrating with external systems (ERP, e-commerce platforms, shipping carriers).
- **[LOW] Multi-tenancy isolation** — organization-level data isolation is not enforced at the query layer. A bug or misconfiguration could expose one organization's data to another.
