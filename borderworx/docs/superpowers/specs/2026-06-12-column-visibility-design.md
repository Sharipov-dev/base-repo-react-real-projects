# Column Visibility — Design Spec

**Date:** 2026-06-12
**Branch:** feat/partial-receipt

---

## Overview

Add per-table column visibility controls to all `DataTable`-based tables. Users can show or hide any column via a "Columns" dropdown in the toolbar. Preferences persist to `localStorage` per table so they survive page refreshes.

---

## Architecture

Column visibility is built directly into the shared `DataTable` component (`src/shared/ui/DataTable/DataTable.tsx`). No new files are created.

One new optional prop is added:

```ts
columnVisibilityKey?: string
```

When omitted, the table behaves exactly as today (fully backwards-compatible). When provided, the column picker is activated for that table.

---

## DataTable Changes

### New prop

```ts
interface DataTableProps<T> {
  // ... existing props ...
  columnVisibilityKey?: string;
}
```

### State

```ts
const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
  if (!columnVisibilityKey) return new Set();
  try {
    const stored = localStorage.getItem(`columns:${columnVisibilityKey}`);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
});
const [pickerOpen, setPickerOpen] = useState(false);
```

### Column filtering

Before rendering, the columns array is filtered:

```ts
const visibleColumns = columnVisibilityKey
  ? columns.filter(col => !hiddenColumns.has(col.key))
  : columns;
```

All existing header and cell render logic uses `visibleColumns` instead of `columns`.

### Columns button placement

Rendered at the far right of the toolbar row, after `{toolbar}`:

```tsx
{columnVisibilityKey && (
  <ColumnPicker
    columns={columns}
    hiddenColumns={hiddenColumns}
    onChange={(next) => {
      setHiddenColumns(next);
      localStorage.setItem(`columns:${columnVisibilityKey}`, JSON.stringify([...next]));
    }}
    onReset={() => {
      setHiddenColumns(new Set());
      localStorage.removeItem(`columns:${columnVisibilityKey}`);
    }}
    open={pickerOpen}
    onToggle={() => setPickerOpen(v => !v)}
  />
)}
```

---

## ColumnPicker

Implemented as a local function component inside `DataTable.tsx` (~50 lines). Not exported.

**Props:**
- `columns: ColumnDef<T>[]` — all columns (unfiltered, for rendering checkboxes)
- `hiddenColumns: Set<string>`
- `onChange(next: Set<string>): void`
- `onReset(): void`
- `open: boolean`
- `onToggle(): void`

**Behavior:**
- Toggle button shows a columns icon + "Columns" label + chevron
- Dropdown opens below the button, right-aligned
- Each column renders as a labeled checkbox (`col.header` as label)
- Toggling a column calls `onChange` with the updated set
- The last visible column's checkbox is disabled (cannot hide all columns)
- "Reset" link at the bottom calls `onReset`
- Clicking outside closes the picker (`useEffect` + `mousedown` on `document`)

---

## localStorage Format

```
key:   "columns:{columnVisibilityKey}"
value: JSON array of hidden column keys, e.g. ["warehouse", "requestedDate"]
```

Stored as hidden keys (not visible keys) so adding new columns to a table in the future shows them by default.

---

## Tables Updated

Each table gets `columnVisibilityKey` added to its `<DataTable>` call:

| Table file | Key |
|---|---|
| `modules/organization/ui/OrganizationTable.tsx` | `organizations` |
| `modules/purchase-order/ui/PurchaseOrderTable.tsx` | `purchase-orders` |
| `modules/shipper/ui/ShipperTable.tsx` | `shippers` |
| `modules/location/ui/LocationTable.tsx` | `locations` |
| `modules/user/ui/UserTable.tsx` | `users` |
| `modules/return/ui/ReturnTable.tsx` | `returns` |
| `modules/role/ui/RoleTable.tsx` | `roles` |

### Out of scope

`OrderTable`, `OrderPickingTable`, `OrderShippingTable`, `OrderFulfillmentTable` use the legacy `TableHelpers` pattern and are excluded. They can adopt the feature when migrated to `DataTable`.

---

## Backwards Compatibility

`columnVisibilityKey` is optional. All existing `DataTable` usages without the prop are unaffected — no behavioral change, no visual change.
