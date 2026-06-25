---
phase: 02-export-rollout-to-remaining-tables-wire-csv-excel-export-ont
plan: 03
subsystem: receipt, item
tags: [export, csv, xlsx, datatable, filter-aware]
requires:
  - DataTable export props (exportFileBaseName, onExportAll, exportAllCount, ColumnDef.exportValue)
  - listReceipts (status filter), listItems (search filter)
provides:
  - Receipts table CSV/XLSX export with status-filter-aware all-records
  - Items table CSV/XLSX export with search-filter-aware all-records
affects:
  - borderworxWMSFrontend/src/modules/receipt/ui/ReceiptTable.tsx
  - borderworxWMSFrontend/src/modules/item/ui/ItemTable.tsx
tech-stack:
  added: []
  patterns:
    - per-column exportValue mirroring displayed cell formatting
    - page-loop handleExportAll threading the active server filter
key-files:
  created: []
  modified:
    - borderworxWMSFrontend/src/modules/receipt/ui/ReceiptTable.tsx
    - borderworxWMSFrontend/src/modules/item/ui/ItemTable.tsx
decisions:
  - Added a status filter select to ReceiptTable so the locked must-have ("export respects the active server status filter") is actually exercisable; the same statusFilter state drives both the table query and the export page-loop.
metrics:
  duration: ~10m
  completed: 2026-06-25
  tasks: 2
  files: 2
---

# Phase 02 Plan 03: Export Rollout to Receipts and Items Summary

Wired filter-aware CSV/XLSX export onto the Receipts and Items DataTables, mirroring the Organizations reference pattern: per-column `exportValue` formatting plus a page-loop `handleExportAll` that threads each table's active server filter.

## What Was Built

### Task 1 — ReceiptTable export (commit 9d1845a)
- Added `exportValue` to all 7 columns: `receiptNumber`, `referenceNumber` (Reference), `customerName`, `warehouseName`, `status`, `lineCount`, and `receiptDate` (ISO `string` formatted via `new Date(r.receiptDate).toLocaleDateString()` — never `.toISOString()`).
- Added `handleExportAll(): Promise<Receipt[]>` page-looping `listReceipts` at `EXPORT_PAGE_SIZE = 100`, threading the active `status` filter on every page (`status: statusFilter || undefined`), breaking on `result.data.length < EXPORT_PAGE_SIZE || all.length >= result.meta.totalCount`.
- Wired `exportFileBaseName="receipts"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}`.

### Task 2 — ItemTable export (commit 0db8361)
- Added `exportValue` to all columns: `sku`, `name`, `category` (`?? ''`), `uom` (`secondaryUom ?? ''`), composite `tracking` (`[serialTracking && 'SN', lotTracking && 'LOT', expiryTracking && 'EXP'].filter(Boolean).join(',')`, mirroring the SN/LOT/EXP badge cell), and `status` (`isActive ? 'Active' : 'Inactive'`).
- Added `handleExportAll(): Promise<Item[]>` page-looping `listItems`, threading the active `search` value (`search: dSearch || undefined` — the deferred state that drives the table query) on every page, same break condition.
- Wired `exportFileBaseName="items"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Added status filter state/UI to ReceiptTable**
- **Found during:** Task 1
- **Issue:** The plan's action and the locked must-have ("'All records' export on Receipts respects the active server status filter") assume a `statusFilter` state "that drives the table query." ReceiptTable had no status filter state or UI at all — the query used only `{ page, pageSize }`. Without it, threading an active status filter into the export was impossible and the must-have could not be satisfied.
- **Fix:** Added `const [statusFilter, setStatusFilter] = useState('')`, included it in the React Query key and `listReceipts` call, surfaced a minimal status `<select>` in the existing toolbar (All/pending/received/partial/processed/cancelled — values matching `STATUS_COLORS`), and threaded the same `statusFilter` into `handleExportAll`. This makes the table query and the export consistently filter-aware.
- **Files modified:** borderworxWMSFrontend/src/modules/receipt/ui/ReceiptTable.tsx
- **Commit:** 9d1845a

ItemTable required no such deviation — it already had `search`/`dSearch` deferred state driving `listItems`; the export simply threads that existing value.

## Verification

- Acceptance greps pass: `exportFileBaseName="receipts"` + `handleExportAll` (Receipts), `exportFileBaseName="items"` + `handleExportAll` (Items).
- `npx tsc --noEmit` produced no errors in either touched file (strict TypeScript; no `any`, typed `Receipt[]`/`Item[]` accumulators).
- Full `npm run build` deferred to verify plan 02-05 per plan instructions.
- Date export uses `toLocaleDateString()` on the ISO string (Pitfall 1 avoided).

## Known Stubs

None.

## Self-Check: PASSED

- borderworxWMSFrontend/src/modules/receipt/ui/ReceiptTable.tsx — FOUND, contains `exportFileBaseName="receipts"`.
- borderworxWMSFrontend/src/modules/item/ui/ItemTable.tsx — FOUND, contains `exportFileBaseName="items"`.
- Commit 9d1845a — FOUND on feat/table-export.
- Commit 0db8361 — FOUND on feat/table-export.
