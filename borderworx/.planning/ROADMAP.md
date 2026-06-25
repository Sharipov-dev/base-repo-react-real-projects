# Roadmap: BorderworxWMS

## Overview

Table Export milestone: ship a reusable Export button + modal that lets users export
any DataTable to CSV or Excel, then roll that capability out across every DataTable-based
table in the app. Phase 1 delivered the infrastructure and the first table (Organizations);
subsequent phases extend it to the remaining tables.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Table Export Infrastructure + Organizations** - Export utilities, ExportModal, DataTable wiring, and Organizations table wired
- [x] **Phase 2: Export Rollout to DataTable Tables** - Wire export onto the 8 DataTable-based tables: locations, customers, users, roles, receipts, items, inventory, and inventory transaction history
- [ ] **Phase 3: Migrate + Export Legacy Tables** - Migrate warehouses and customer contacts to DataTable, then wire export onto them

## Phase Details

### Phase 1: Table Export Infrastructure + Organizations
**Goal**: Build the reusable export stack (CSV/XLSX utilities, ExportModal, DataTable export button + handler, ColumnDef export metadata) and wire it onto the Organizations table.
**Depends on**: Nothing (first phase)
**Success Criteria** (what must be TRUE):
  1. User can click Export on the Organizations table and choose CSV or Excel.
  2. Export respects currently visible columns and uses each column's export value.
  3. "All records" export pulls every page, not just the current one.
**Plans**: 7 plans

Plans:
- [x] 01-01: Install xlsx dependency
- [x] 01-02: Export utilities module (toCsv, toXlsx, downloadBlob, fileName)
- [x] 01-03: Extend ColumnDef with exportValue/exportHeader
- [x] 01-04: ExportModal component
- [x] 01-05: Wire export button + state + handler into DataTable
- [x] 01-06: Wire Organizations table columns + export props
- [x] 01-07: Page-loop fix for all-records export

### Phase 2: Export Rollout to DataTable Tables
**Goal**: Wire the existing export stack onto the 8 DataTable-based tables — locations, customers, users, roles, receipts, items, inventory, and inventory transaction history — by adding per-column `exportValue`/`exportHeader` callbacks and passing `exportFileBaseName` + an all-records handler, following the Organizations reference. (Warehouses and customer contacts are deferred to Phase 3 — they are not DataTable-based.)
**Depends on**: Phase 1
**Requirements**: SC-1, SC-2, SC-3 (mapped from Success Criteria)
**Success Criteria** (what must be TRUE):
  1. User can export each of the 8 tables to CSV or Excel via the Export button.
  2. Each export respects currently visible columns and uses the same value formatting shown in the table, with FK ids resolved to human-readable names where applicable (e.g. Users roleId, Transactions inventoryId).
  3. "All records" export pulls every page (page-loop) and respects active table filters, exporting only rows matching the current filter.
**Plans**: 5 plans

Plans:
- [x] 02-01-PLAN.md — Wire export onto Locations + Customers (client-filter-aware; remove dead Customers Export button)
- [x] 02-02-PLAN.md — Wire export onto Users + Roles (roleId→name resolution; search threading)
- [x] 02-03-PLAN.md — Wire export onto Receipts + Items (status/search threading; string dates; composite tracking)
- [x] 02-04-PLAN.md — Wire export onto Inventory + Inventory Transactions (inline-typed; inventoryId label; type/search threading)
- [x] 02-05-PLAN.md — Phase verify: `npm run build` + manual export smoke-check across all 8 tables

### Phase 3: Migrate and Export Legacy Tables
**Goal**: Convert `WarehouseTable` and `CustomerContactsManager` from legacy `TableHelpers` markup to the shared `DataTable` component, then wire CSV/Excel export onto them following the Phase 2 pattern.
**Depends on**: Phase 2
**Requirements**: TBD
**Success Criteria** (what must be TRUE):
  1. Warehouses and customer contacts render via the shared DataTable (column visibility, sorting, pagination intact).
  2. User can export both tables to CSV or Excel via the Export button, matching Phase 2 behavior.
**Plans**: TBD (run `/gsd-plan-phase 3` to break down)

Plans:
- [ ] TBD (run /gsd-plan-phase 3 to break down)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Table Export Infrastructure + Organizations | 7/7 | Complete | 2026-06-24 |
| 2. Export Rollout to DataTable Tables | 5/5 | Complete | 2026-06-25 |
| 3. Migrate and Export Legacy Tables | 0/TBD | In progress | - |
