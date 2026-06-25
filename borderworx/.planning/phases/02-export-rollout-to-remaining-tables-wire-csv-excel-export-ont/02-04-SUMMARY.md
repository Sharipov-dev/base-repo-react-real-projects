---
phase: 02-export-rollout-to-remaining-tables-wire-csv-excel-export-ont
plan: 04
subsystem: inventory
tags: [export, csv, xlsx, datatable, inventory, transactions]
requires:
  - DataTable export props (exportFileBaseName/onExportAll/exportAllCount, ColumnDef.exportValue)
  - listInventory / listInventoryTransactions list APIs
provides:
  - Inventory table CSV/XLSX export (search-filter aware)
  - Inventory Transactions table CSV/XLSX export (type-filter aware)
  - inventoryId -> "SKU — Name" label resolution via listInventory lookup Map
affects:
  - borderworxWMSFrontend/src/modules/inventory/ui/InventoryTable.tsx
  - borderworxWMSFrontend/src/modules/inventory/ui/InventoryTransactionsTable.tsx
tech-stack:
  added: []
  patterns:
    - "FK-label resolution via a lookup Map built from a sibling list API (mirrors 02-02 listRoles/resolveRoleName)"
    - "Inline-typed table -> explicit DataTable<T> generic + typed accumulator for strict-TS export"
key-files:
  created: []
  modified:
    - borderworxWMSFrontend/src/modules/inventory/ui/InventoryTable.tsx
    - borderworxWMSFrontend/src/modules/inventory/ui/InventoryTransactionsTable.tsx
decisions:
  - "Transactions inventoryId exports a human-readable 'SKU — Name' label resolved via a Map built from listInventory (page 1, pageSize 1000), falling back to the FULL inventoryId — never the .slice(0,8) display value."
metrics:
  duration: ~10m
  completed: 2026-06-25
---

# Phase 02 Plan 04: Inventory & Transactions Export Wiring Summary

CSV/XLSX export wired onto the Inventory and Inventory Transactions DataTables, with transactions' `inventoryId` FK resolved to a readable "SKU — Name" label via a `listInventory` lookup Map (full-id fallback), and all-records page-loops threading each table's active server filter.

## What Was Built

### Task 1 — InventoryTable export (commit 63982a6)
- Added `exportValue` callbacks to all 9 columns: `itemSku`, `itemName`, `locationCode`, `quantity`, `allocatedQuantity`, `availableQuantity`, `lotNumber` (`?? ''`), `expiryDate` and `updatedAt` (ISO `string` -> `new Date(...).toLocaleDateString()`; no `.toISOString()` on strings).
- Added `async handleExportAll(): Promise<InventoryEntry[]>` page-loop over `listInventory`, threading the active `dSearch` value on every page (`search: dSearch || undefined`), `EXPORT_PAGE_SIZE = 100`, standard break condition.
- Converted inline `ColumnDef<typeof rows[number]>` to explicit `ColumnDef<InventoryEntry>` + `<DataTable<InventoryEntry>>` generic, with a typed accumulator `const all: InventoryEntry[] = []` (Pitfall 3, no `any`).
- Wired `exportFileBaseName="inventory"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}`.

### Task 2 — InventoryTransactionsTable export (commit 880a118)
- Added a lookup query `useQuery(['inventory-export-labels'], () => listInventory({ page: 1, pageSize: 1000 }, accessToken))`.
- Built `inventoryLabelMap = new Map<string, string>` keyed by `entry.id` -> `` `${itemSku} — ${itemName}` ``, plus `resolveInventoryLabel(id)` returning the mapped label or the FULL `inventoryId` fallback (never the truncated `.slice(0,8)` display value).
- Added `exportValue` callbacks: `type` (`TRANSACTION_TYPE_LABELS`), `inventoryId` (`resolveInventoryLabel`), `quantityBefore`, `quantityChange` (signed: `+N` / `String(N)`), `quantityAfter`, `reason` (`?? ''`), `referenceType` (`?? ''`), `createdAt` (`new Date(...).toLocaleString()`).
- Added `async handleExportAll(): Promise<InventoryTransaction[]>` page-loop over `listInventoryTransactions`, threading active `typeFilter` (`type: typeFilter || undefined`), typed accumulator.
- Converted to explicit `ColumnDef<InventoryTransaction>[]` + `<DataTable<InventoryTransaction>>` generic (no inline `typeof rows[number]`, no `any`).
- Wired `exportFileBaseName="inventory-transactions"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}`.

## Deviations from Plan

None — plan executed exactly as written. The `listInventory` lookup-Map approach for `inventoryId` resolution (rather than nonexistent `tx.itemSku`/`tx.itemName` fields) was followed per the revised plan and confirmed against `inventory/model/types.ts` (`InventoryTransaction` carries only `inventoryId`).

## Authentication Gates

None.

## Known Stubs

None.

## Verification

- Task 1 automated grep: `exportFileBaseName="inventory"` + `handleExportAll` present — PASS.
- Task 2 automated grep: `exportFileBaseName="inventory-transactions"` + `handleExportAll` + `listInventory` present — PASS.
- Touched-file type-check: `npx tsc --noEmit` reported no errors in either modified file (full `npm run build` deferred to plan 02-05).
- Both tables retain the explicit `DataTable<T>` generic with no `any` introduced.

## Self-Check: PASSED

- FOUND: commit 63982a6 (InventoryTable)
- FOUND: commit 880a118 (InventoryTransactionsTable)
- FOUND: src/modules/inventory/ui/InventoryTable.tsx
- FOUND: src/modules/inventory/ui/InventoryTransactionsTable.tsx
