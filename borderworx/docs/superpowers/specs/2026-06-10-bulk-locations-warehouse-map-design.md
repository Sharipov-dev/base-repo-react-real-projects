# Bulk Location Creation + Warehouse Map — Design

**Date:** 2026-06-10
**Status:** Approved (brainstorm)
**Components:** `borderworxWMS` (backend), `borderworxWMSFrontend` (frontend)

## Problem

Locations today are created one at a time through `Manage Locations`. Standing up or
extending a warehouse means hundreds of manual inserts. There is also no visual way to
see which slots are taken and which are free — operators read a flat table.

## Goals

1. **Bulk Create Locations** — generate many locations at once from per-dimension ranges.
2. **Warehouse Map** — a visual, color-coded rack view showing slot occupancy.

Both live under the existing **Warehouse** sidebar group and are purely additive.

## Domain context

A `Location` is a hierarchical slot keyed by `zone → aisle → bay → level → position`,
plus `locationType`, `capacity`, `maxWeight`, `maxVolume`, `dimensions`, `barcode`
(currently the only unique field), `isActive`, `nonPickable`, and `warehouseId`.
Occupancy is derivable from `Inventory.locationId`. The owning `Warehouse` has a `code`
used for barcode generation.

## Navigation

Two new items in the **Warehouse** sidebar section (`src/widgets/Sidebar/Sidebar.tsx`),
with routes added to `src/shared/config/routes.ts`, `PROTECTED_PATHS`, and middleware:

- **Bulk Create Locations** → `/locations/bulk`
- **Warehouse Map** → `/locations/map`

---

## Feature 1: Bulk Create Locations

### UX (single page, three on-screen steps)

1. **Define**
   - Select a warehouse.
   - One value-set input per dimension (`zone`, `aisle`, `bay`, `level`, `position`).
     Each accepts:
     - list — `A, B, C`
     - numeric range — `1-10`
     - zero-padded numeric range — `01-10`
   - Shared attributes applied to every generated slot: `locationType`, `capacity`,
     `maxWeight`, `maxVolume`, `dimensions`, `isActive`, `nonPickable`.
   - Barcode pattern, default `{whCode}-{zone}-{aisle}-{bay}-{level}-{position}`, built
     from the selected warehouse's `code`.
2. **Preview**
   - Frontend expands the cartesian product of the value-sets locally and shows the total
     count plus a sample table (generated address + barcode).
   - Frontend calls the backend in **dry-run** mode to flag entries that already exist
     (duplicate address or barcode collision).
3. **Confirm**
   - On confirm, the same payload is re-sent with `dryRun: false`.
   - Backend creates valid slots transactionally and returns `{ created, skipped[] }`.
   - A result summary is shown (e.g. "184 created, 16 skipped — already existed").

### Backend

New endpoint `POST /api/locations/bulk`, body:

```
{ locations: CreateLocationDto[], dryRun?: boolean }
```

- **DTO** — `bulkCreateLocationsSchema` in `location.dto.ts`: an array of the existing
  create shape (≤ 2000 items) plus optional `dryRun`.
- **Use-case** — `BulkCreateLocationsUseCase`:
  - enforce batch-size cap
  - detect duplicate addresses within the batch
  - query existing addresses + barcodes in the warehouse
  - if `dryRun`: return `{ wouldCreate, skipped: [{ address, reason }] }` without writing
  - else: `createMany` valid rows in a transaction, return `{ created, skipped }`
- **Repository** (`LocationRepository`) — add:
  - `findExistingAddresses(warehouseId, tuples)` (or equivalent existence check)
  - `createMany(data[])`
- **Controller + route** — new `bulkCreate` method and `POST /` bulk route, following the
  existing `location.controller.ts` / `location.routes.ts` patterns (auth + `validate`).

### Frontend module additions (`src/modules/location`)

- `lib/expandRanges.ts` — parse a value-set string → string[]; cartesian product of all
  five dimensions → location specs.
- `lib/buildBarcode.ts` — apply the barcode pattern to a spec.
- `api/location.api.ts` — `bulkCreateLocations(payload, accessToken)`.
- `model/schema.ts` + `model/types.ts` — bulk request/response shapes.
- `ui/BulkCreateLocationsForm.tsx` — the three-step page.
- Page: `src/app/(protected)/locations/bulk/page.tsx`.

---

## Feature 2: Warehouse Map (rack elevation)

### UX

- `Warehouse → Zone → Aisle` dropdowns at the top.
- On aisle selection, render the rack head-on: **levels as rows, bays as columns**.
  Multiple positions within a bay/level render as sub-cells inside the cell.
- Cell color is **binary by inventory presence**: a slot is **occupied** (blue) when it
  has at least one `Inventory` row with `quantity > 0`, otherwise **empty** (green);
  `isActive === false` slots render gray and take precedence over occupancy color.
- Clicking a slot opens a **read-only popover**: address, type, capacity, barcode, and the
  inventory items currently in the slot (sku/name, qty, lot).

### Backend (two read endpoints)

- `GET /api/locations/structure?warehouseId=` → `{ zones: [{ zone, aisles: string[] }] }`
  (distinct values) to populate the dropdowns.
- `GET /api/locations/occupancy?warehouseId=&zone=&aisle=` → the aisle's locations, each
  with `occupied: boolean` and an `inventory[]` summary for the popover.
- **Repository** — add `findDistinctStructure(warehouseId)` and an occupancy query joining
  `Location` with its `Inventory` (+ `Item`).

### Frontend module additions

- `api/location.api.ts` — `getLocationStructure(...)`, `getAisleOccupancy(...)`.
- `model/schema.ts` + `model/types.ts` — structure & occupancy shapes.
- `ui/WarehouseMap.tsx` — dropdowns + rack grid + slot popover.
- Page: `src/app/(protected)/locations/map/page.tsx`.

---

## Targeted integrity improvement

Add a unique constraint/index on `(warehouseId, zone, aisle, bay, level, position)` in
`prisma/schema.prisma` via a migration. This guards against duplicate slots, speeds the
bulk dedup check, and benefits occupancy queries. **The plan must include a one-time check
that no duplicate addresses exist before applying the constraint**, and a remediation note
if any are found.

## Testing

- Frontend unit tests: `expandRanges` (lists, ranges, padded ranges, cartesian product)
  and `buildBarcode` (pattern substitution).
- Backend use-case tests: `BulkCreateLocationsUseCase` dedup + dry-run + cap behavior;
  structure and occupancy query mapping.
- Frontend api test mirroring `src/modules/warehouse/__tests__/warehouse.api.test.ts` for
  the new location api functions.

## Out of scope (YAGNI)

3D/isometric view, CSV import, capacity-based partial coloring, edit/deactivate from the
map, drag-and-drop layout designer. All can be layered on later.
