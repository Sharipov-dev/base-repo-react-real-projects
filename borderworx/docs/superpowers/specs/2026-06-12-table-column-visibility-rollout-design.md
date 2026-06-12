# Column Visibility Rollout — Customers, Receipts, Items, Inventory, Transaction History

**Date:** 2026-06-12
**Status:** Approved
**Depends on:** `2026-06-12-column-visibility-design.md` (the feature itself, already shipped on the Organization table)

## Goal

Bring the existing column-visibility ("customize table view") feature to five more
tables: Customers, Receipts, Items, Inventory, and Transaction History.

## Background

The column-visibility feature is not a standalone widget. It lives inside the shared
`DataTable` component (`src/shared/ui/DataTable/DataTable.tsx`) and is switched on with a
single optional prop, `columnVisibilityKey`. The Organization table already runs on
`DataTable`, so the feature was one line there.

The five target tables are all still built on the legacy hand-rolled `TableHelpers`
markup. They do **not** use `DataTable`. Therefore "the same thing" means migrating each
table onto `DataTable` — defining its columns in the `ColumnDef` schema and turning on
`columnVisibilityKey`. Column visibility then comes for free, identically to Organization.

This is the same migration the Organization table already went through.

## Approach

For each of the five tables:

1. Replace the legacy `TableHelpers` table/toolbar/pagination markup with a `<DataTable>`.
2. Define the table's columns as a `ColumnDef<Row>[]` array, each column with a unique
   `key`, a `header`, and the appropriate `type` (or a `custom` cell).
3. Define row actions as `RowAction<Row>[]` where the table has them.
4. Move existing toolbar controls (search, create/add, download, filters, nav links) into
   the `DataTable` `toolbar` prop and the built-in search.
5. Set `columnVisibilityKey` to activate the picker.
6. Leave all modals, mutations, query hooks, and search semantics unchanged.

Frontend-only. No backend changes. Preferences persist in `localStorage` per table.

## DataTable enhancements

Three small, additive, backward-compatible changes are needed to migrate Receipts without
losing behavior. All are optional and leave the Organization table and all current
behavior untouched.

### `onRowClick?: (row: T) => void`

Receipts currently opens the detail panel when the user clicks anywhere on a row. The user
chose to preserve this exactly. `DataTable` gains an optional `onRowClick`. When provided,
each `<tr>` becomes clickable (cursor-pointer, calls `onRowClick(row)`). When omitted,
rows behave exactly as today.

Guard: clicks on the row-actions cell must not trigger `onRowClick` (stop propagation in
the actions cell) so the action buttons and row-click do not conflict.

### `RowAction.hidden?: (row: T) => boolean`

Receipts has conditional "Close" and "Delete" actions that only apply when
`status === 'pending'` (Close opens `PartialReceiptModal`). Today `rowActions` render
unconditionally on every row. Add an optional `hidden?(row)` predicate to `RowAction`;
when it returns `true`, that action is not rendered for that row. Existing actions (no
predicate) always render, unchanged.

### `RowAction.icon` may be a function

Receipts' Close action shows a per-row spinner while its detail is loading. Widen
`RowAction.icon` from `React.ReactNode` to `React.ReactNode | ((row: T) => React.ReactNode)`.
Static-node icons (every current action) keep working unchanged; the renderer calls the
function form per row when provided.

## Per-table specification

The `columnVisibilityKey` model stores **hidden** column keys (not visible ones), so any
column added to a table in the future shows by default. Default state for every table:
all columns visible. The Actions column is always present and is never part of the picker.

### Customers — `columnVisibilityKey="customers"`

- **File:** `src/modules/customer/ui/CustomerTable.tsx`
- **Row type:** `Customer`. **Hook:** `listCustomers(page, pageSize, accessToken)`, pageSize 20.
- **Columns:**
  1. `name` — custom cell (violet icon + name + `ID: {id.slice(0,8)}` secondary line)
  2. `email` — custom cell (`email ?? '-'`)
  3. `phone` — custom cell (`phone ?? '-'`)
  4. `company` — custom cell (`alias ?? name`)
  5. `location` — custom cell (`[city, state].filter(Boolean).join(', ') || country`)
- **Row actions:** View (navigates to `ROUTES.customerDetail(id)` — current behavior; the
  eye icon is a `Link` today, becomes a `router.push`), Edit, Delete.
- **Toolbar:** built-in search (client-side filter on name/alias/email/phone/city/state/country/contact fields — preserved), Export button, Create Customer link. The existing
  non-functional "Customize View" placeholder button (and its `SettingsIcon`) is removed —
  the real Columns picker replaces it.
- **Modals preserved:** `CustomerEditForm` (Edit), delete confirmation. (`CustomerDetailsPanel`
  is currently unreachable dead code reached by no path; left untouched.)
- **Search:** client-side. `onSearchChange` updates local search state; data is filtered
  before being passed to `DataTable`.

### Receipts — `columnVisibilityKey="receipts"`

- **File:** `src/modules/receipt/ui/ReceiptTable.tsx`
- **Row type:** `Receipt`. **Hook:** `listReceipts({ page, pageSize }, accessToken)`, pageSize 20.
- **Columns:**
  1. `receiptNumber` — custom cell (`receiptNumber`, mono blue)
  2. `reference` — custom cell (`referenceNumber`)
  3. `customer` — custom cell (`customerName`)
  4. `warehouse` — custom cell (`warehouseName`)
  5. `status` — custom cell (badge via `STATUS_COLORS`: pending / received / partial / processed / cancelled)
  6. `lines` — custom cell (`lineCount`)
  7. `date` — custom cell (`receiptDate`)
- **Row actions:** View (eye icon, opens the line-items modal via `handleView`), Close
  (conditional via `RowAction.hidden`, only `status === 'pending'`; opens `PartialReceiptModal`
  on shortfall; uses function `icon` for the loading spinner), Delete (conditional, only
  `status === 'pending'`).
- **Row click:** navigates to `ROUTES.receiptDetail(id)` via the new `onRowClick`
  (preserves current row-click behavior — distinct from the eye-icon modal).
- **Toolbar:** New Receipt button only. **No search box** (the list hook takes no search
  param and none exists today — do not pass `onSearchChange`).
- **Title:** none today (page renders its own header); title/subtitle move into `DataTable`
  and the redundant page-level header in `receipts/page.tsx` is removed.
- **Modals preserved:** `CreateReceiptModal`, `ReceiptDetailPanel` (view modal),
  `PartialReceiptModal`, delete confirmation.

### Items — `columnVisibilityKey="items"`

- **File:** `src/modules/item/ui/ItemTable.tsx`
- **Row type:** `Item`. **Hook:** `listItems(page, pageSize, search, accessToken)`, pageSize 20.
- **Columns:**
  1. `sku` — custom cell (`sku`, monospace blue)
  2. `name` — custom cell (`name`)
  3. `category` — custom cell (`category ?? '—'`)
  4. `uom` — custom cell (`secondaryUom ?? '—'`)
  5. `tracking` — custom cell (SN / LOT / EXP badges from serial/lot/expiry tracking flags)
  6. `status` — custom cell rendering the legacy `StatusBadge status={isActive ? 'active' : 'passive'}`
- **Row actions:** View, Edit, Delete.
- **Toolbar:** built-in search (server-side, SKU or name; resets page to 1), Create Item link.
- **Title:** none today (page renders its own header); title/subtitle move into `DataTable`
  and the redundant page-level header in `items/page.tsx` is removed.
- **Modals preserved:** `ItemDetailsPanel`, `ItemEditForm`, delete confirmation.

### Inventory — `columnVisibilityKey="inventory"`

- **File:** `src/modules/inventory/ui/InventoryTable.tsx`
- **Row type:** inventory entry. **Hook:** `listInventory({ page, pageSize, search }, accessToken)`, pageSize 20.
- **Columns (9):**
  1. `sku` — custom cell (`itemSku`, monospace blue)
  2. `itemName` — custom cell (`itemName`)
  3. `location` — custom cell (`locationCode`)
  4. `quantity` — custom cell (`quantity`)
  5. `allocated` — custom cell (`allocatedQuantity`)
  6. `available` — custom cell (`availableQuantity`, green if > 0 else red)
  7. `lotNumber` — custom cell (`lotNumber ?? '-'`)
  8. `expiry` — custom cell (`expiryDate` formatted or `-`)
  9. `updated` — custom cell (`updatedAt` formatted date)
- **Row actions:** none.
- **Toolbar:** built-in search (server-side, SKU; resets page to 1), Extended View / Adjust / Move nav links.
- **Title:** in-component title ("Inventory" / "Real-time stock levels") moves into `DataTable`; page wrapper unchanged.
- **Modals preserved:** none.

### Transaction History — `columnVisibilityKey="inventory-transactions"`

- **File:** `src/modules/inventory/ui/InventoryTransactionsTable.tsx`
- **Row type:** `InventoryTransaction`. **Hook:**
  `listInventoryTransactions({ page, pageSize, type }, accessToken)`, pageSize 20.
- **Columns:**
  1. `type` — custom cell (colored badge; 11 transaction-type colors)
  2. `inventoryId` — custom cell (monospace, truncated)
  3. `quantityBefore` — custom cell (number)
  4. `quantityChange` — custom cell (signed, green/red/gray)
  5. `quantityAfter` — custom cell (number)
  6. `reason` — custom cell (truncated)
  7. `reference` — custom cell (`referenceType`)
  8. `date` — custom cell (`createdAt`, date + time)
- **Row actions:** none.
- **Toolbar:** type-filter `<select>` (preserved in `toolbar`, resets page to 1),
  total-records count. No search box (do not pass `onSearchChange`).
- **Title:** in-component title ("Transaction History") moves into `DataTable`; the
  redundant `p-6` wrapper in `inventory/transactions/page.tsx` is removed.
- **Modals preserved:** none.

## Badge rendering rule

- Simple, fixed status sets that map to the `StatusBadge` palette → use the `status` column
  type with a `colorMap` (Receipt status, Item status).
- Bespoke multi-color badges with arbitrary Tailwind classes (transaction types, item
  tracking, item category) → use `custom` cells that reproduce the current markup.

## Persistence

`localStorage` only, key `columns:{columnVisibilityKey}` → JSON array of hidden column
keys. Per browser/machine, not synced across devices. No backend, no user_preferences
table. Identical to the Organization implementation.

## Out of scope

- Backend or cross-device persistence of column preferences.
- Column sorting, reordering, or resizing.
- Default-hidden columns (every table starts with all columns visible).
- Any change to the underlying data, queries, modals, or mutations.

## Verification

For each migrated table:

- Renders the same data and cell formatting as before.
- All row actions, modals, create/edit/delete flows, search, filters, and pagination still work.
- Receipts: row click opens the detail panel; the Close action appears only for the
  applicable statuses.
- The "Columns" dropdown lists every data column, toggles each, disables the last visible
  column, and Reset restores all.
- Hidden-column state survives a page refresh (localStorage).
- `npm run build` and `npm run lint` pass with no new errors.

## Files touched

- `src/shared/ui/DataTable/DataTable.tsx` — add `onRowClick`, `RowAction.hidden`, and function `RowAction.icon`.
- `src/modules/customer/ui/CustomerTable.tsx`
- `src/modules/receipt/ui/ReceiptTable.tsx`
- `src/app/(protected)/receipts/page.tsx` — remove redundant page header/wrapper.
- `src/modules/item/ui/ItemTable.tsx`
- `src/app/(protected)/items/page.tsx` — remove redundant page header/wrapper.
- `src/modules/inventory/ui/InventoryTable.tsx`
- `src/modules/inventory/ui/InventoryTransactionsTable.tsx`
- `src/app/(protected)/inventory/transactions/page.tsx` — remove redundant `p-6` wrapper.

No new files.
