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

Two small, additive, backward-compatible props are needed to migrate Receipts without
losing behavior. Both are optional and leave the Organization table and all current
behavior untouched.

### `onRowClick?: (row: T) => void`

Receipts currently opens the detail panel when the user clicks anywhere on a row. The user
chose to preserve this exactly. `DataTable` gains an optional `onRowClick`. When provided,
each `<tr>` becomes clickable (cursor-pointer, calls `onRowClick(row)`). When omitted,
rows behave exactly as today.

Guard: clicks on the row-actions cell must not trigger `onRowClick` (stop propagation in
the actions cell) so the action buttons and row-click do not conflict.

### `RowAction.hidden?: (row: T) => boolean`

Receipts has a conditional "Close" action that only applies to certain statuses, opening
`PartialReceiptModal`. Today `rowActions` render unconditionally on every row. Add an
optional `hidden?(row)` predicate to `RowAction`; when it returns `true`, that action is
not rendered for that row. Existing actions (no predicate) always render, unchanged.

## Per-table specification

The `columnVisibilityKey` model stores **hidden** column keys (not visible ones), so any
column added to a table in the future shows by default. Default state for every table:
all columns visible. The Actions column is always present and is never part of the picker.

### Customers — `columnVisibilityKey="customers"`

- **File:** `src/modules/customer/ui/CustomerTable.tsx`
- **Row type:** `Customer`. **Hook:** `listCustomers(page, pageSize, accessToken)`, pageSize 20.
- **Columns:**
  1. `name` — entity (icon + name, alias as secondary line)
  2. `email` — `email`
  3. `phone` — `phone`
  4. `company` — `company`
  5. `location` — custom cell (city, state, country combined)
- **Row actions:** View, Edit, Delete.
- **Toolbar:** built-in search (client-side filter on name/alias/email/phone/city/state/country/contact fields — preserved), Download button, Add button.
- **Modals preserved:** `CustomerDetailsPanel`, `CustomerEditForm`, delete confirmation.
- **Search:** client-side. `onSearchChange` updates local search state; data is filtered
  before being passed to `DataTable`.

### Receipts — `columnVisibilityKey="receipts"`

- **File:** `src/modules/receipt/ui/ReceiptTable.tsx`
- **Row type:** `Receipt`. **Hook:** `listReceipts(page, pageSize, search, accessToken)`, pageSize 20.
- **Columns:**
  1. `receiptNumber` — `id` / receipt number
  2. `reference` — `reference`
  3. `customer` — custom cell (customer link/name)
  4. `warehouse` — custom cell (warehouse badge)
  5. `status` — `status` type with `colorMap` (pending / received / partial / processed / cancelled)
  6. `lines` — custom cell (`lineCount`)
  7. `date` — `date`
- **Row actions:** View (via `onRowClick`, opens detail panel), Close (conditional via
  `RowAction.hidden`, opens `PartialReceiptModal`), Delete.
- **Toolbar:** built-in search (server-side), Create Receipt button.
- **Modals preserved:** `CreateReceiptModal`, `ReceiptDetailPanel`, `PartialReceiptModal`,
  delete confirmation.
- **Search:** server-side via `dSearch` query param (unchanged).

### Items — `columnVisibilityKey="items"`

- **File:** `src/modules/item/ui/ItemTable.tsx`
- **Row type:** `Item`. **Hook:** `listItems(page, pageSize, search, accessToken)`, pageSize 20.
- **Columns:**
  1. `sku` — custom cell (monospace, blue)
  2. `name` — `name`
  3. `category` — custom cell (badge)
  4. `uom` — `uom`
  5. `tracking` — custom cell (badge: Serial / Expiry / None)
  6. `status` — `status` type with `colorMap`
- **Row actions:** View, Edit, Delete.
- **Toolbar:** built-in search (server-side, SKU or name), Add Item button (links to create route).
- **Modals preserved:** `ItemDetailsPanel`, `ItemEditForm`, delete confirmation.

### Inventory — `columnVisibilityKey="inventory"`

- **File:** `src/modules/inventory/ui/InventoryTable.tsx`
- **Row type:** `Inventory`. **Hook:** `listInventory(page, pageSize, search, accessToken)`, pageSize 20.
- **Columns:**
  1. `sku` — custom cell (monospace, blue)
  2. `itemName` — `itemName`
  3. `warehouse` — custom cell (name + code)
  4. `onHand` — custom cell (formatted number)
  5. `available` — custom cell (formatted number, green)
  6. `reserved` — custom cell (formatted number, orange)
  7. `shelfLocation` — `shelfLocation`
- **Row actions:** none.
- **Toolbar:** built-in search (server-side, SKU), Extended View / Adjust / Move nav links.
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
- **Toolbar:** type-filter `<select>` (preserved in `toolbar`), total-records count. No search box
  (do not pass `onSearchChange`).
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

- `src/shared/ui/DataTable/DataTable.tsx` — add `onRowClick` and `RowAction.hidden`.
- `src/modules/customer/ui/CustomerTable.tsx`
- `src/modules/receipt/ui/ReceiptTable.tsx`
- `src/modules/item/ui/ItemTable.tsx`
- `src/modules/inventory/ui/InventoryTable.tsx`
- `src/modules/inventory/ui/InventoryTransactionsTable.tsx`

No new files.
