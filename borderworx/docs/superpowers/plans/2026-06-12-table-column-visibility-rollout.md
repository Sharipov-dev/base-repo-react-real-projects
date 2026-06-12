# Column Visibility Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing column-visibility ("customize table view") feature to the Customers, Receipts, Items, Inventory, and Transaction History tables by migrating each from the legacy `TableHelpers` markup onto the shared `DataTable` component.

**Architecture:** The column-visibility feature lives entirely inside `DataTable` (`src/shared/ui/DataTable/DataTable.tsx`) and is switched on with the optional `columnVisibilityKey` prop. The five target tables are still hand-rolled on `TableHelpers`. Migrating each onto `DataTable` (defining columns in the `ColumnDef` schema) gives them the feature for free, identically to the already-migrated Organization table. Two small, backward-compatible additions to `DataTable` are needed first so Receipts migrates without losing behavior. Frontend-only, `localStorage` persistence, no backend.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), React, Tailwind CSS, TanStack Query.

---

## Testing approach (read first)

This frontend has **no React component-test harness**: `package.json` defines `test: vitest run`, but `@testing-library/react`/jsdom are **not installed**, so rendered-component assertions are not possible without standing up new infrastructure — which is out of scope for this UI migration. Per the codebase's actual workflow, the automated gate for every task is:

- `npm run build` — Next.js production build, which runs full TypeScript strict type-checking. This is the primary safety net: prop/field/type mismatches fail the build.
- `npm run lint` — ESLint (`next lint`).

Plus the **manual verification checklist** in each task. Do **not** invent component tests or add a testing-library dependency.

Run `dev` server with `npm run dev` (port 3001) for manual checks.

---

## File structure

| File | Change |
|---|---|
| `src/shared/ui/DataTable/DataTable.tsx` | Add `onRowClick` prop, `RowAction.hidden` predicate, allow `RowAction.icon` to be a render function. |
| `src/modules/customer/ui/CustomerTable.tsx` | Migrate to `DataTable`, `columnVisibilityKey="customers"`. Remove dead "Customize View" placeholder button. |
| `src/modules/receipt/ui/ReceiptTable.tsx` | Migrate to `DataTable`, `columnVisibilityKey="receipts"`. Uses `onRowClick` + `RowAction.hidden` + icon-function. |
| `src/app/(protected)/receipts/page.tsx` | Remove redundant page-level header/wrapper (title moves into `DataTable`). |
| `src/modules/item/ui/ItemTable.tsx` | Migrate to `DataTable`, `columnVisibilityKey="items"`. |
| `src/app/(protected)/items/page.tsx` | Remove redundant page-level header/wrapper. |
| `src/modules/inventory/ui/InventoryTable.tsx` | Migrate to `DataTable`, `columnVisibilityKey="inventory"`. |
| `src/modules/inventory/ui/InventoryTransactionsTable.tsx` | Migrate to `DataTable`, `columnVisibilityKey="inventory-transactions"`. |
| `src/app/(protected)/inventory/transactions/page.tsx` | Remove redundant `p-6` wrapper (table provides its own header; layout already pads). |

In every table: **all modals, inline forms, mutations, query hooks, helper components, and detail panels stay exactly as they are.** Only the main exported component's imports, the new `columns`/`rowActions` arrays, and the rendered table/toolbar/pagination block change.

Each table inherits `DataTable`'s standard chrome: green header row (`bg-green-50`), built-in search/pagination, and the "Columns" picker. Header-row background color normalizing from `bg-blue-50`/`bg-emerald-50` to `bg-green-50` is expected and approved.

---

## Task 1: DataTable enhancements (onRowClick, conditional + dynamic row actions)

**Files:**
- Modify: `src/shared/ui/DataTable/DataTable.tsx`

These three changes are additive and backward-compatible. The Organization table and all current behavior are unaffected (no existing caller passes `onRowClick`, `hidden`, or a function `icon`).

- [ ] **Step 1: Widen the `RowAction` interface**

Find:

```tsx
export interface RowAction<T> {
  label: string;
  icon: React.ReactNode;
  onClick: (row: T) => void;
  variant?: 'default' | 'danger';
}
```

Replace with:

```tsx
export interface RowAction<T> {
  label: string;
  icon: React.ReactNode | ((row: T) => React.ReactNode);
  onClick: (row: T) => void;
  variant?: 'default' | 'danger';
  hidden?: (row: T) => boolean;
}
```

- [ ] **Step 2: Add the `onRowClick` prop to `DataTableProps`**

Find the end of the `DataTableProps<T>` interface:

```tsx
  pagination?: PaginationState;
  columnVisibilityKey?: string;
}
```

Replace with:

```tsx
  pagination?: PaginationState;
  columnVisibilityKey?: string;
  onRowClick?: (row: T) => void;
}
```

- [ ] **Step 3: Destructure `onRowClick` in the component signature**

Find:

```tsx
  pagination,
  columnVisibilityKey,
}: DataTableProps<T>) {
```

Replace with:

```tsx
  pagination,
  columnVisibilityKey,
  onRowClick,
}: DataTableProps<T>) {
```

- [ ] **Step 4: Make data rows clickable when `onRowClick` is provided**

Find the data-row `<tr>` (inside `data.map((row) => (`):

```tsx
                  <tr
                    key={rowKey(row)}
                    className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/60"
                  >
```

Replace with:

```tsx
                  <tr
                    key={rowKey(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={[
                      'border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/60',
                      onRowClick ? 'cursor-pointer' : '',
                    ].join(' ')}
                  >
```

- [ ] **Step 5: Honor `hidden`, function `icon`, and stop row-click on the actions cell**

Find the actions cell:

```tsx
                    {showActions && (
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          {rowActions.map((action) => (
                            <button
                              key={action.label}
                              onClick={() => action.onClick(row)}
                              title={action.label}
                              className={[
                                'rounded-md p-1.5 transition-colors',
                                action.variant === 'danger'
                                  ? 'text-red-400 hover:bg-red-50 hover:text-red-500'
                                  : 'text-blue-400 hover:bg-blue-50 hover:text-blue-500',
                              ].join(' ')}
                            >
                              {action.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
```

Replace with:

```tsx
                    {showActions && (
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {rowActions
                            .filter((action) => !action.hidden?.(row))
                            .map((action) => (
                            <button
                              key={action.label}
                              onClick={() => action.onClick(row)}
                              title={action.label}
                              className={[
                                'rounded-md p-1.5 transition-colors',
                                action.variant === 'danger'
                                  ? 'text-red-400 hover:bg-red-50 hover:text-red-500'
                                  : 'text-blue-400 hover:bg-blue-50 hover:text-blue-500',
                              ].join(' ')}
                            >
                              {typeof action.icon === 'function' ? action.icon(row) : action.icon}
                            </button>
                          ))}
                        </div>
                      </td>
                    )}
```

- [ ] **Step 6: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: build succeeds, no new lint errors. (The Organization table still compiles because all new props are optional.)

- [ ] **Step 7: Manual smoke check**

Run `npm run dev`, open `/organizations`. Confirm it is unchanged: columns picker works, rows are NOT clickable (no cursor-pointer), actions work.

- [ ] **Step 8: Commit**

```bash
git add src/shared/ui/DataTable/DataTable.tsx
git commit -m "feat(DataTable): add onRowClick, conditional and dynamic row actions"
```

---

## Task 2: Migrate Customers to DataTable

**Files:**
- Modify: `src/modules/customer/ui/CustomerTable.tsx`

Customer keeps **client-side** search (existing `deferredSearch` filter), its Edit/Delete modals, and navigates to the customer detail route on View (current behavior — the eye icon is a `Link` today). The dead "Customize View" placeholder button and its `SettingsIcon` are removed (the real Columns picker replaces it).

- [ ] **Step 1: Update imports**

Find:

```tsx
import { Th, ActionBtn, PageBtn, buildPages, Spinner, SearchIcon, PlusIcon, DownloadIcon, EyeIcon, EditIcon, TrashIcon } from '@/shared/ui/TableHelpers';
```

Replace with:

```tsx
import { useRouter } from 'next/navigation';
import { Spinner, PlusIcon, DownloadIcon, EyeIcon, EditIcon, TrashIcon } from '@/shared/ui/TableHelpers';
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
import { Users } from 'lucide-react';
```

(`Users` is already imported from `lucide-react` on line 5 — if so, leave that line and drop `Users` from this added import to avoid a duplicate. `Link` and `ROUTES` imports stay.)

- [ ] **Step 2: Add a router and define columns + row actions**

Inside `CustomerTable`, just after `const queryClient = useQueryClient();`, add:

```tsx
  const router = useRouter();
```

Then, immediately before the `return (`, after `const meta = data?.meta;`, add:

```tsx
  const columns: ColumnDef<Customer>[] = [
    {
      key: 'name',
      header: 'Customer Name',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (c) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-400">
            <PersonIcon />
          </span>
          <div>
            <p className="font-medium text-gray-900">{c.name}</p>
            <p className="text-xs text-gray-400">ID: {c.id.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (c) => <span className="text-gray-600">{c.email ?? '-'}</span>,
    },
    {
      key: 'phone',
      header: 'Phone',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (c) => <span className="text-gray-600">{c.phone ?? '-'}</span>,
    },
    {
      key: 'company',
      header: 'Company',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (c) => <span className="text-gray-600">{c.alias ?? c.name}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (c) => <span className="text-gray-600">{[c.city, c.state].filter(Boolean).join(', ') || c.country}</span>,
    },
  ];

  const rowActions: RowAction<Customer>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: (c) => router.push(ROUTES.customerDetail(c.id)) },
    { label: 'Edit', icon: <EditIcon />, onClick: setEditItem },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteItem, variant: 'danger' },
  ];
```

- [ ] **Step 3: Replace the page-header + toolbar + table block with `<DataTable>`**

Replace the entire block from `<div className="flex flex-col gap-5">` (line ~69) through its matching closing `</div>` that ends just before `<Modal open={viewItem !== null}` (line ~216) with:

```tsx
      <DataTable<Customer>
        title="Customers Management"
        titleIcon={<Users size={22} />}
        subtitle="View and manage all customers with Excel-like filtering and customization"
        columns={columns}
        data={rows}
        rowKey={(c) => c.id}
        rowActions={rowActions}
        searchPlaceholder="Search by Customer Name, Email, Phone, Company, or Location..."
        onSearchChange={setSearch}
        toolbar={
          <>
            <Link
              href={ROUTES.customersNew}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              <PlusIcon />
              Create Customer
            </Link>
            <button className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              <DownloadIcon />
              Export
            </button>
          </>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No customers found."
        pagination={
          meta && meta.totalPages > 1
            ? { page: meta.page, pageSize: meta.pageSize, totalCount: meta.totalCount, totalPages: meta.totalPages, onPageChange: setPage }
            : undefined
        }
        columnVisibilityKey="customers"
      />
```

Leave the three `<Modal>` blocks (View/Edit/Delete) and everything below them unchanged.

- [ ] **Step 4: Delete the now-unused `SettingsIcon` component**

Find and delete the entire `SettingsIcon` function near the bottom of the file:

```tsx
function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.5 1v1.5M7.5 12.5V14M14 7.5h-1.5M2.5 7.5H1M11.7 3.3l-1.1 1.1M4.4 10.6l-1.1 1.1M11.7 11.7l-1.1-1.1M4.4 4.4L3.3 3.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
```

(`PersonIcon` is still used by the `name` column and the detail panel — keep it.)

- [ ] **Step 5: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: success, no unused-import/variable errors. If `Th`, `ActionBtn`, `PageBtn`, `buildPages`, or `SearchIcon` are reported unused, confirm they were removed from the import in Step 1.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/customers`:
- Header reads "Customers Management" with the Users icon (only once — no double header).
- Search filters rows live; Create Customer and Export buttons present.
- "Columns" dropdown lists Customer Name / Email / Phone / Company / Location; toggling hides/shows each; the last visible column cannot be unchecked; Reset restores all.
- View navigates to the customer detail page; Edit and Delete open their modals; delete works.
- Refresh the page with a column hidden → it stays hidden (localStorage `columns:customers`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/customer/ui/CustomerTable.tsx
git commit -m "feat(customer): migrate CustomerTable to DataTable with column visibility"
```

---

## Task 3: Migrate Receipts to DataTable

**Files:**
- Modify: `src/modules/receipt/ui/ReceiptTable.tsx`
- Modify: `src/app/(protected)/receipts/page.tsx`

Receipts has **no search**. Row-click navigates to the detail route (`onRowClick`). The View (eye) action opens the line-items modal via `handleView`. Close and Delete are **both** conditional on `status === 'pending'` (`RowAction.hidden`). The Close icon shows a per-row spinner while loading (function `icon`).

- [ ] **Step 1: Update imports**

Find:

```tsx
import {
  Th,
  ActionBtn,
  PageBtn,
  buildPages,
  Spinner,
  PlusIcon,
  EyeIcon,
  TrashIcon,
} from '@/shared/ui/TableHelpers';
```

Replace with:

```tsx
import { Spinner, PlusIcon, EyeIcon, TrashIcon } from '@/shared/ui/TableHelpers';
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
```

(`useRouter`, `ROUTES`, `Modal`, the mutations, `PartialReceiptModal`, `CreateReceiptModal`, `CloseIcon`, and `STATUS_COLORS` all stay.)

- [ ] **Step 2: Define columns + row actions**

Immediately before `return (`, after `const meta = data?.meta;`, add:

```tsx
  const columns: ColumnDef<Receipt>[] = [
    {
      key: 'receiptNumber',
      header: 'Receipt #',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => <span className="font-mono text-sm font-medium text-blue-600">{r.receiptNumber}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => <span className="text-gray-900">{r.referenceNumber}</span>,
    },
    {
      key: 'customer',
      header: 'Customer',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => <span className="text-gray-700">{r.customerName}</span>,
    },
    {
      key: 'warehouse',
      header: 'Warehouse',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => <span className="text-gray-700">{r.warehouseName}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (r) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            STATUS_COLORS[r.status] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'lines',
      header: 'Lines',
      type: 'custom',
      cell: (r) => <span className="text-gray-600">{r.lineCount}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => <span className="text-gray-500">{new Date(r.receiptDate).toLocaleDateString()}</span>,
    },
  ];

  const rowActions: RowAction<Receipt>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: handleView },
    {
      label: 'Close Receipt',
      icon: (r) => (closeLoading && closeTarget?.id === r.id ? <Spinner /> : <CloseIcon />),
      onClick: handleClose,
      hidden: (r) => r.status !== 'pending',
    },
    {
      label: 'Delete',
      icon: <TrashIcon />,
      onClick: setDeleteTarget,
      variant: 'danger',
      hidden: (r) => r.status !== 'pending',
    },
  ];
```

- [ ] **Step 3: Replace the layout + table block with `<DataTable>`**

Replace the block from `<div className="flex flex-col gap-5">` (line ~125) through its matching closing `</div>` just before `<CreateReceiptModal` (line ~255) with:

```tsx
      <DataTable<Receipt>
        title="Receipts"
        subtitle="Manage goods receipts and process them into inventory"
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        onRowClick={(r) => router.push(ROUTES.receiptDetail(r.id))}
        toolbar={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            New Receipt
          </button>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No receipts found."
        pagination={
          meta && meta.totalPages > 1
            ? { page: meta.page, pageSize: meta.pageSize, totalCount: meta.totalCount, totalPages: meta.totalPages, onPageChange: setPage }
            : undefined
        }
        columnVisibilityKey="receipts"
      />
```

Leave `<CreateReceiptModal>`, the View `<Modal>`, `<PartialReceiptModal>`, the Delete `<Modal>`, and the `ReceiptDetailPanel` component below unchanged.

> Note: with no `onSearchChange` passed, `DataTable` renders no search box (matching today). Because `toolbar` is the only top-bar content and search is absent, the "New Receipt" button and "Columns" picker sit together at the top — acceptable and approved.

- [ ] **Step 4: Remove the redundant page header in `receipts/page.tsx`**

Open `src/app/(protected)/receipts/page.tsx`. Replace:

```tsx
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Receipts</h1>
        <p className="text-sm text-gray-500">Manage goods receipts and process them into inventory</p>
      </div>
      <ReceiptTable accessToken={accessToken!} />
    </div>
  );
```

with:

```tsx
  return <ReceiptTable accessToken={accessToken!} />;
```

(The `<main>` in `PageShell` already provides `p-6`; the title now comes from `DataTable`.)

- [ ] **Step 5: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: success, no unused-import errors (`Th`/`ActionBtn`/`PageBtn`/`buildPages` removed in Step 1).

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/receipts`:
- Single "Receipts" header (no double header), New Receipt button, Columns picker; no search box.
- Clicking a row navigates to the receipt detail page.
- Clicking the eye (View) opens the line-items modal and does **not** navigate.
- A `pending` receipt shows Close + Delete; a non-pending receipt shows only View.
- Close on a receipt with a shortfall opens `PartialReceiptModal`; without shortfall it closes directly. The Close button shows a spinner while loading.
- Columns picker toggles each data column; hidden state persists across refresh (`columns:receipts`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/receipt/ui/ReceiptTable.tsx "src/app/(protected)/receipts/page.tsx"
git commit -m "feat(receipt): migrate ReceiptTable to DataTable with column visibility"
```

---

## Task 4: Migrate Items to DataTable

**Files:**
- Modify: `src/modules/item/ui/ItemTable.tsx`
- Modify: `src/app/(protected)/items/page.tsx`

Item keeps **server-side** search (resets page to 1) and its View/Edit/Delete modals. Status uses the legacy `StatusBadge` from `TableHelpers` (rendered in a custom cell to preserve its exact look). Tracking renders the SN/LOT/EXP badges.

- [ ] **Step 1: Update imports**

Find:

```tsx
import {
  Th,
  ActionBtn,
  PageBtn,
  buildPages,
  Spinner,
  SearchIcon,
  PlusIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
  StatusBadge,
} from '@/shared/ui/TableHelpers';
```

Replace with:

```tsx
import { Spinner, PlusIcon, EyeIcon, EditIcon, TrashIcon, StatusBadge } from '@/shared/ui/TableHelpers';
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
```

(`Link`, `ROUTES`, `Modal` stay. `StatusBadge` and `Spinner` are still used.)

- [ ] **Step 2: Define columns + row actions**

Immediately before `return (`, after `const meta = data?.meta;`, add:

```tsx
  const columns: ColumnDef<Item>[] = [
    {
      key: 'sku',
      header: 'SKU',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (item) => <span className="font-mono text-sm font-medium text-blue-600">{item.sku}</span>,
    },
    {
      key: 'name',
      header: 'Name',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (item) => <span className="text-gray-900">{item.name}</span>,
    },
    {
      key: 'category',
      header: 'Category',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (item) => <span className="text-gray-500">{item.category ?? '—'}</span>,
    },
    {
      key: 'uom',
      header: 'UOM',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (item) => <span className="text-gray-600">{item.secondaryUom ?? '—'}</span>,
    },
    {
      key: 'tracking',
      header: 'Tracking',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (item) => (
        <div className="flex items-center gap-1">
          {item.serialTracking && (
            <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">SN</span>
          )}
          {item.lotTracking && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">LOT</span>
          )}
          {item.expiryTracking && (
            <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">EXP</span>
          )}
          {!item.serialTracking && !item.lotTracking && !item.expiryTracking && (
            <span className="text-xs text-gray-300">—</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (item) => <StatusBadge status={item.isActive ? 'active' : 'passive'} />,
    },
  ];

  const rowActions: RowAction<Item>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewItem },
    { label: 'Edit', icon: <EditIcon />, onClick: setEditItem },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteTargetItem, variant: 'danger' },
  ];
```

- [ ] **Step 3: Replace the layout + table block with `<DataTable>`**

Replace the block from `<div className="flex flex-col gap-5">` (line ~64) through its matching closing `</div>` just before `<Modal open={viewItem !== null}` (line ~199) with:

```tsx
      <DataTable<Item>
        title="Items"
        subtitle="Manage your SKU catalog"
        columns={columns}
        data={rows}
        rowKey={(item) => item.id}
        rowActions={rowActions}
        searchPlaceholder="Search by SKU or name..."
        onSearchChange={(v) => { setSearch(v); setPage(1); }}
        toolbar={
          <Link
            href={ROUTES.itemsNew}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            Create Item
          </Link>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No items found."
        pagination={
          meta && meta.totalPages > 1
            ? { page: meta.page, pageSize: meta.pageSize, totalCount: meta.totalCount, totalPages: meta.totalPages, onPageChange: setPage }
            : undefined
        }
        columnVisibilityKey="items"
      />
```

Leave the View/Edit/Delete `<Modal>` blocks and the `ItemDetailsPanel`/`ItemEditForm`/helpers below unchanged.

- [ ] **Step 4: Remove the redundant page header in `items/page.tsx`**

Open `src/app/(protected)/items/page.tsx`. Replace:

```tsx
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <p className="text-sm text-gray-500">Manage your SKU catalog</p>
      </div>
      <ItemTable accessToken={accessToken!} />
    </div>
  );
```

with:

```tsx
  return <ItemTable accessToken={accessToken!} />;
```

- [ ] **Step 5: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: success, no unused-import errors.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/items`:
- Single "Items" header, search box, Create Item button, Columns picker.
- Search filters server-side and resets to page 1.
- Status badge and SN/LOT/EXP tracking badges render as before.
- View/Edit/Delete modals work.
- Columns picker toggles SKU/Name/Category/UOM/Tracking/Status; persists across refresh (`columns:items`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/item/ui/ItemTable.tsx "src/app/(protected)/items/page.tsx"
git commit -m "feat(item): migrate ItemTable to DataTable with column visibility"
```

---

## Task 5: Migrate Inventory to DataTable

**Files:**
- Modify: `src/modules/inventory/ui/InventoryTable.tsx`

Inventory is read-only (no row actions). It keeps **server-side** SKU search (resets page to 1) and the Extended View / Adjust / Move toolbar links. Its in-component title moves into `DataTable`; the page wrapper needs no change.

- [ ] **Step 1: Update imports**

Find:

```tsx
import { Th, PageBtn, buildPages, SearchIcon } from '@/shared/ui/TableHelpers';
```

Replace with:

```tsx
import { DataTable, type ColumnDef } from '@/shared/ui/DataTable';
```

(`Link`, `ROUTES`, `listInventory`, `useQuery`, and `ArrowsExpandIcon` stay.)

- [ ] **Step 2: Define columns**

Immediately before `return (`, after `const meta = data?.meta;`, add:

```tsx
  const columns: ColumnDef<typeof rows[number]>[] = [
    {
      key: 'sku',
      header: 'SKU',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (entry) => <span className="font-mono text-xs font-medium text-blue-600">{entry.itemSku}</span>,
    },
    {
      key: 'itemName',
      header: 'Item Name',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (entry) => <span className="text-gray-700">{entry.itemName}</span>,
    },
    {
      key: 'location',
      header: 'Location',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (entry) => <span className="text-gray-600">{entry.locationCode}</span>,
    },
    {
      key: 'quantity',
      header: 'Qty',
      type: 'custom',
      cell: (entry) => <span className="font-medium text-gray-700">{entry.quantity}</span>,
    },
    {
      key: 'allocated',
      header: 'Allocated',
      type: 'custom',
      cell: (entry) => <span className="text-gray-600">{entry.allocatedQuantity}</span>,
    },
    {
      key: 'available',
      header: 'Available',
      type: 'custom',
      cell: (entry) => (
        <span className={`font-semibold ${entry.availableQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
          {entry.availableQuantity}
        </span>
      ),
    },
    {
      key: 'lotNumber',
      header: 'Lot #',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (entry) => <span className="text-gray-600">{entry.lotNumber ?? '-'}</span>,
    },
    {
      key: 'expiry',
      header: 'Expiry',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (entry) => (
        <span className="text-gray-600">
          {entry.expiryDate ? new Date(entry.expiryDate).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      key: 'updated',
      header: 'Updated',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (entry) => <span className="text-gray-400">{new Date(entry.updatedAt).toLocaleDateString()}</span>,
    },
  ];
```

> If `ColumnDef<typeof rows[number]>` causes a type error, import the row type explicitly instead: add `import type { InventoryEntry } from '../model/types';` (use whatever the row type is actually named in `../model/types`) and write `ColumnDef<InventoryEntry>[]`. Confirm the field names (`itemSku`, `itemName`, `locationCode`, `quantity`, `allocatedQuantity`, `availableQuantity`, `lotNumber`, `expiryDate`, `updatedAt`) match that type.

- [ ] **Step 3: Replace the whole returned tree with `<DataTable>`**

Replace the entire `return ( ... );` body (the outer `<div className="flex flex-col gap-5">` … `</div>`, lines ~37–166) with:

```tsx
  return (
    <DataTable
      title="Inventory"
      subtitle="Real-time stock levels"
      columns={columns}
      data={rows}
      rowKey={(entry) => entry.id}
      searchPlaceholder="Search by SKU..."
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      toolbar={
        <>
          <Link href={ROUTES.inventoryDetails}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
            <ArrowsExpandIcon />
            Extended View
          </Link>
          <Link href={ROUTES.inventoryAdjust}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Adjust
          </Link>
          <Link href={ROUTES.inventoryMove}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Move
          </Link>
        </>
      }
      isLoading={isLoading}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : undefined}
      emptyMessage="No inventory records found."
      pagination={
        meta && meta.totalPages > 1
          ? { page: meta.page, pageSize: meta.pageSize, totalCount: meta.totalCount, totalPages: meta.totalPages, onPageChange: setPage }
          : undefined
      }
      columnVisibilityKey="inventory"
    />
  );
```

- [ ] **Step 4: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: success. Resolve any row-type error per the note in Step 2.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, open `/inventory`:
- "Inventory" header, search, Extended View / Adjust / Move links, Columns picker.
- All 9 columns render with correct values; Available is green/red; search resets to page 1.
- Columns picker toggles each column; the last visible column cannot be hidden; persists across refresh (`columns:inventory`).

- [ ] **Step 6: Commit**

```bash
git add src/modules/inventory/ui/InventoryTable.tsx
git commit -m "feat(inventory): migrate InventoryTable to DataTable with column visibility"
```

---

## Task 6: Migrate Transaction History to DataTable

**Files:**
- Modify: `src/modules/inventory/ui/InventoryTransactionsTable.tsx`
- Modify: `src/app/(protected)/inventory/transactions/page.tsx`

Read-only, no row actions, **no search**. The type-filter `<select>` and the total-records counter move into the toolbar. Title/subtitle move into `DataTable`.

- [ ] **Step 1: Update imports**

Find:

```tsx
import { Th, PageBtn, buildPages } from '@/shared/ui/TableHelpers';
```

Replace with:

```tsx
import { DataTable, type ColumnDef } from '@/shared/ui/DataTable';
```

(Keep `listInventoryTransactions`, `useQuery`, `useState`, and the `TRANSACTION_TYPE_*` / `PAGE_SIZE` / `TRANSACTION_TYPES` constants.)

- [ ] **Step 2: Define columns**

Immediately before `return (`, after `const meta = data?.meta;` (and the `handleTypeChange` function), add:

```tsx
  const columns: ColumnDef<typeof rows[number]>[] = [
    {
      key: 'type',
      header: 'Type',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (tx) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            TRANSACTION_TYPE_COLORS[tx.type] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type}
        </span>
      ),
    },
    {
      key: 'inventoryId',
      header: 'Inventory ID',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (tx) => <span className="font-mono text-xs text-gray-400">{tx.inventoryId.slice(0, 8)}…</span>,
    },
    {
      key: 'before',
      header: 'Before',
      type: 'custom',
      cell: (tx) => <span className="text-gray-600">{tx.quantityBefore}</span>,
    },
    {
      key: 'change',
      header: 'Change',
      type: 'custom',
      cell: (tx) => (
        <span
          className={`font-semibold ${
            tx.quantityChange > 0 ? 'text-green-600' : tx.quantityChange < 0 ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {tx.quantityChange > 0 ? '+' : ''}{tx.quantityChange}
        </span>
      ),
    },
    {
      key: 'after',
      header: 'After',
      type: 'custom',
      cell: (tx) => <span className="font-medium text-gray-700">{tx.quantityAfter}</span>,
    },
    {
      key: 'reason',
      header: 'Reason',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'max-w-[180px] truncate text-left',
      cell: (tx) => <span className="text-gray-500">{tx.reason ?? '-'}</span>,
    },
    {
      key: 'reference',
      header: 'Reference',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (tx) => (tx.referenceType ? <span className="font-mono text-xs text-gray-500">{tx.referenceType}</span> : <span className="text-gray-500">-</span>),
    },
    {
      key: 'date',
      header: 'Date',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'whitespace-nowrap text-left',
      cell: (tx) => <span className="text-gray-400">{new Date(tx.createdAt).toLocaleString()}</span>,
    },
  ];
```

> If `ColumnDef<typeof rows[number]>` errors, import the row type explicitly (e.g. `import type { InventoryTransaction } from '../model/types';`, using the actual exported name) and write `ColumnDef<InventoryTransaction>[]`.

- [ ] **Step 3: Replace the whole returned tree with `<DataTable>`**

Replace the entire `return ( ... );` body (the outer `<div className="flex flex-col gap-5">` … `</div>`, lines ~69–209) with:

```tsx
  return (
    <DataTable
      title="Transaction History"
      subtitle="Full audit log of all inventory movements"
      columns={columns}
      data={rows}
      rowKey={(tx) => tx.id}
      toolbar={
        <div className="flex flex-1 items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All types</option>
            {TRANSACTION_TYPES.map((t) => (
              <option key={t} value={t}>{TRANSACTION_TYPE_LABELS[t] ?? t}</option>
            ))}
          </select>
          {meta && (
            <p className="ml-auto text-xs text-gray-500">
              {meta.totalCount.toLocaleString()} total records
            </p>
          )}
        </div>
      }
      isLoading={isLoading}
      isError={isError}
      errorMessage={error instanceof Error ? error.message : undefined}
      emptyMessage="No transactions found."
      pagination={
        meta && meta.totalPages > 1
          ? { page: meta.page, pageSize: meta.pageSize, totalCount: meta.totalCount, totalPages: meta.totalPages, onPageChange: setPage }
          : undefined
      }
      columnVisibilityKey="inventory-transactions"
    />
  );
```

> No `onSearchChange` ⇒ no search box (matches today). The toolbar wrapper uses `flex-1` so the total-count keeps its right-aligned (`ml-auto`) position, with the Columns picker after it.

- [ ] **Step 4: Simplify the transactions page wrapper**

Open `src/app/(protected)/inventory/transactions/page.tsx`. Replace:

```tsx
  return (
    <div className="p-6">
      <InventoryTransactionsTable accessToken={accessToken!} />
    </div>
  );
```

with:

```tsx
  return <InventoryTransactionsTable accessToken={accessToken!} />;
```

(`PageShell`'s `<main>` already provides `p-6`.)

- [ ] **Step 5: Type-check and lint**

Run: `npm run build && npm run lint`
Expected: success, no unused-import errors.

- [ ] **Step 6: Manual verification**

Run `npm run dev`, open `/inventory/transactions`:
- "Transaction History" header, type-filter select, total-records count, Columns picker; no search box.
- Type filter narrows the list and resets to page 1.
- Type badges, signed Change coloring, mono Inventory ID, and date/time render as before.
- Columns picker toggles all 8 columns; persists across refresh (`columns:inventory-transactions`).

- [ ] **Step 7: Commit**

```bash
git add src/modules/inventory/ui/InventoryTransactionsTable.tsx "src/app/(protected)/inventory/transactions/page.tsx"
git commit -m "feat(inventory): migrate Transaction History to DataTable with column visibility"
```

---

## Final verification

- [ ] **Full build + lint**

Run: `npm run build && npm run lint`
Expected: clean.

- [ ] **Cross-table manual sweep**

Visit `/organizations`, `/customers`, `/receipts`, `/items`, `/inventory`, `/inventory/transactions`. Each has a working Columns picker, hidden state persisting independently per table in `localStorage` (`columns:organizations`, `columns:customers`, `columns:receipts`, `columns:items`, `columns:inventory`, `columns:inventory-transactions`). All actions, modals, search, filters, navigation, and pagination behave as before. No double headers.
