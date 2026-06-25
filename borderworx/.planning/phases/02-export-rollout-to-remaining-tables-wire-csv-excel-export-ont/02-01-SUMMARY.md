---
phase: 02-export-rollout-to-remaining-tables-wire-csv-excel-export-ont
plan: 01
subsystem: frontend-datatables
tags: [export, csv, xlsx, datatable, locations, customers]
requires:
  - shared/ui/DataTable export props (exportFileBaseName/onExportAll/exportAllCount)
  - shared/lib/export utilities (shipped Phase 1)
  - OrganizationTable reference wiring
provides:
  - Locations table CSV/XLSX export (client-filter-aware all-records)
  - Customers table CSV/XLSX export (client-search-aware all-records)
affects:
  - borderworxWMSFrontend/src/modules/location/ui/LocationTable.tsx
  - borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx
tech-stack:
  added: []
  patterns:
    - "Per-column exportValue callbacks mirroring each column's cell render"
    - "handleExportAll EXPORT_PAGE_SIZE=100 page-loop then re-apply active client-side filter predicate"
key-files:
  created: []
  modified:
    - borderworxWMSFrontend/src/modules/location/ui/LocationTable.tsx
    - borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx
decisions:
  - "All-records export re-applies the table's active client-side filters so only filtered rows export (honors LOCKED phase decision)."
  - "Customers dead toolbar Export button removed; unused DownloadIcon import dropped."
metrics:
  duration: ~10m
  tasks: 2
  files: 2
  completed: 2026-06-25
---

# Phase 2 Plan 01: Export Rollout to Locations & Customers Summary

Wired CSV/Excel export onto the Locations and Customers DataTables by replicating the Organizations reference pattern, with all-records exports that page-loop the list API and then re-apply the table's active client-side filters; also removed the duplicate dead Export button on Customers.

## What Was Built

### Task 1: Locations export (commit `5bf18b6`)
- Added `exportValue` callbacks to data columns (`select` checkbox column intentionally left without one):
  - `locationId` → `getDisplayId(loc)`
  - `type` → `TYPE_LABELS[loc.locationType]`
  - `barcode` → `getDisplayId(loc)`
  - `status` → `loc.isActive ? 'Active' : 'Inactive'`
  - `pickable` → `loc.nonPickable ? 'Non-pickable' : 'Pickable'`
- Added `async handleExportAll(): Promise<Location[]>` — page-loops `listLocations` at `EXPORT_PAGE_SIZE=100`, breaks on short page or totalCount reached, then re-applies the exact `rows` predicate (warehouse filter, `applyOperator`+`getDisplayId` location-id query, `statusFilter`) using the deferred query value.
- Passed `exportFileBaseName="locations"`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}` to `<DataTable>`.

### Task 2: Customers export + cleanup (commit `7e22dff`)
- Added `exportValue` callbacks to the 5 data columns (`name`, `email`, `phone`, `company → alias ?? name`, `location → [city, state].filter(Boolean).join(', ') || country`), mirroring each column's cell.
- Added `async handleExportAll(): Promise<Customer[]>` — page-loops `listCustomers` at `EXPORT_PAGE_SIZE=100`, then re-applies the deferred-search predicate used for `rows`.
- Passed `exportFileBaseName="customers"`, `onExportAll`, `exportAllCount` to `<DataTable>`.
- Removed the dead toolbar Export `<button>` (toolbar fragment collapsed to the single Create Customer `Link`) and dropped the now-unused `DownloadIcon` import.

## Acceptance Verification

- LocationTable: `exportFileBaseName="locations"`, `onExportAll={handleExportAll}`, `exportAllCount=` all present; `select` column has no `exportValue`; filter reuse (`applyOperator`/`statusFilter`) present after the page-loop. PASS.
- CustomerTable: `exportFileBaseName="customers"`, `onExportAll={handleExportAll}`, `exportAllCount=` present; `grep -c DownloadIcon` returns 0; search predicate re-applied after page-loop. PASS.
- `npx tsc --noEmit` produced no errors for either touched file (full `npm run build` deferred to phase verify plan 02-05).

## Deviations from Plan

None — plan executed exactly as written. The LocationTable uses a custom toolbar layout rather than DataTable's built-in toolbar/search, so the three export props were added directly to `<DataTable>` (as the plan specified); no extra adaptation was needed.

## Known Stubs

None.

## Self-Check: PASSED

- FOUND commit `5bf18b6` (Locations)
- FOUND commit `7e22dff` (Customers)
- FOUND borderworxWMSFrontend/src/modules/location/ui/LocationTable.tsx
- FOUND borderworxWMSFrontend/src/modules/customer/ui/CustomerTable.tsx
