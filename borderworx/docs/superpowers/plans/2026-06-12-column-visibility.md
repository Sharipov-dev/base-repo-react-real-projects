# Column Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Columns" dropdown to every DataTable-based table so users can show/hide columns, with preferences persisted to localStorage per table.

**Architecture:** The shared `DataTable` component gains a `columnVisibilityKey` prop that activates an inline `ColumnPicker` dropdown. All seven module tables (which currently use raw `TableHelpers` markup) are migrated to `DataTable` as part of this work — this migration is required since no table currently uses `DataTable`. Each migration replaces only the page-header + table + pagination block; all query/mutation/modal code stays unchanged.

**Tech Stack:** React 18, TypeScript strict, Tailwind CSS. No new packages.

---

## File Map

| File | Change |
|---|---|
| `src/shared/ui/DataTable/DataTable.tsx` | Add `ColumnPicker`, `columnVisibilityKey`, `isError`, `header: React.ReactNode` |
| `src/modules/role/ui/RoleTable.tsx` | Migrate to DataTable |
| `src/modules/organization/ui/OrganizationTable.tsx` | Migrate to DataTable |
| `src/modules/purchase-order/ui/PurchaseOrderTable.tsx` | Migrate to DataTable |
| `src/modules/shipper/ui/ShipperTable.tsx` | Migrate to DataTable |
| `src/modules/location/ui/LocationTable.tsx` | Migrate to DataTable |
| `src/modules/user/ui/UserTable.tsx` | Migrate to DataTable |
| `src/modules/return/ui/ReturnTable.tsx` | Migrate to DataTable |

---

## Task 1: Enhance DataTable with column visibility

**Files:**
- Modify: `src/shared/ui/DataTable/DataTable.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { StatusBadge, type StatusColor } from './StatusBadge';

// ─── Column schema ────────────────────────────────────────────────────────────

interface BaseCol {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface TextCol<T> extends BaseCol {
  type: 'text' | 'email' | 'phone';
  accessor: (row: T) => string | null | undefined;
}

interface DateCol<T> extends BaseCol {
  type: 'date';
  accessor: (row: T) => Date;
}

interface StatusCol<T> extends BaseCol {
  type: 'status';
  accessor: (row: T) => string;
  colorMap?: Record<string, StatusColor>;
}

interface EntityCol<T> extends BaseCol {
  type: 'entity';
  primary: (row: T) => string;
  secondary?: (row: T) => string;
  icon?: React.ReactNode;
}

interface CustomCol<T> extends BaseCol {
  type?: 'custom';
  cell: (row: T) => React.ReactNode;
}

export type ColumnDef<T> =
  | TextCol<T>
  | DateCol<T>
  | StatusCol<T>
  | EntityCol<T>
  | CustomCol<T>;

// ─── Row actions ──────────────────────────────────────────────────────────────

export interface RowAction<T> {
  label: string;
  icon: React.ReactNode;
  onClick: (row: T) => void;
  variant?: 'default' | 'danger';
}

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginationState {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface DataTableProps<T> {
  title: string;
  titleIcon?: React.ReactNode;
  subtitle?: string;
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T) => string;
  rowActions?: RowAction<T>[];
  toolbar?: React.ReactNode;
  searchPlaceholder?: string;
  onSearchChange?: (query: string) => void;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  emptyMessage?: string;
  pagination?: PaginationState;
  columnVisibilityKey?: string;
}

// ─── Cell renderer ────────────────────────────────────────────────────────────

function renderCell<T>(col: ColumnDef<T>, row: T): React.ReactNode {
  if (!col.type || col.type === 'custom') {
    return (col as CustomCol<T>).cell(row);
  }

  if (col.type === 'entity') {
    const { primary, secondary, icon } = col as EntityCol<T>;
    return (
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-400">
            {icon}
          </span>
        )}
        <div>
          <p className="font-medium text-gray-900">{primary(row)}</p>
          {secondary && <p className="text-xs text-gray-400">{secondary(row)}</p>}
        </div>
      </div>
    );
  }

  if (col.type === 'date') {
    const date = (col as DateCol<T>).accessor(row);
    return <span>{date.toISOString().slice(0, 10)}</span>;
  }

  if (col.type === 'status') {
    const { accessor, colorMap } = col as StatusCol<T>;
    return <StatusBadge value={accessor(row)} colorMap={colorMap} />;
  }

  const value = (col as TextCol<T>).accessor(row);
  if (value == null || value === '') {
    return <span className="text-gray-300">—</span>;
  }
  return <span>{value}</span>;
}

// ─── Column picker ────────────────────────────────────────────────────────────

interface ColumnPickerProps {
  columns: Array<{ key: string; header: React.ReactNode }>;
  hiddenColumns: Set<string>;
  onChange: (next: Set<string>) => void;
  onReset: () => void;
  open: boolean;
  onToggle: () => void;
}

function ColumnPicker({
  columns,
  hiddenColumns,
  onChange,
  onReset,
  open,
  onToggle,
}: ColumnPickerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onToggle();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, onToggle]);

  const visibleCount = columns.length - hiddenColumns.size;

  function toggle(key: string) {
    const next = new Set(hiddenColumns);
    if (next.has(key)) {
      next.delete(key);
    } else {
      if (visibleCount <= 1) return;
      next.add(key);
    }
    onChange(next);
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
      >
        <ColumnsIcon />
        Columns
        <ChevronDownIcon />
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[200px] rounded-xl border border-gray-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Toggle columns
          </p>
          <div className="flex flex-col gap-0.5">
            {columns.map((col) => {
              const isHidden = hiddenColumns.has(col.key);
              const isLastVisible = !isHidden && visibleCount <= 1;
              return (
                <label
                  key={col.key}
                  className={[
                    'flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-gray-50',
                    isHidden ? 'text-gray-400' : 'text-gray-700',
                    isLastVisible ? 'cursor-not-allowed opacity-50' : '',
                  ].join(' ')}
                >
                  <input
                    type="checkbox"
                    checked={!isHidden}
                    disabled={isLastVisible}
                    onChange={() => toggle(col.key)}
                    className="accent-blue-600"
                  />
                  {col.header}
                </label>
              );
            })}
          </div>
          <div className="mt-2 border-t border-gray-100 pt-2 pr-2 text-right">
            <button
              onClick={onReset}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  title,
  titleIcon,
  subtitle,
  columns,
  data,
  rowKey,
  rowActions,
  toolbar,
  searchPlaceholder = 'Search...',
  onSearchChange,
  isLoading = false,
  isError = false,
  errorMessage,
  emptyMessage = 'No records found.',
  pagination,
  columnVisibilityKey,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(() => {
    if (!columnVisibilityKey || typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem(`columns:${columnVisibilityKey}`);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  const visibleColumns = columnVisibilityKey
    ? columns.filter((col) => !hiddenColumns.has(col.key))
    : columns;

  function handleSearch(value: string) {
    setSearch(value);
    onSearchChange?.(value);
  }

  function handleHiddenChange(next: Set<string>) {
    setHiddenColumns(next);
    localStorage.setItem(`columns:${columnVisibilityKey!}`, JSON.stringify([...next]));
  }

  function handleReset() {
    setHiddenColumns(new Set());
    localStorage.removeItem(`columns:${columnVisibilityKey!}`);
  }

  const showActions = rowActions && rowActions.length > 0;
  const colCount = visibleColumns.length + (showActions ? 1 : 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Page header */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
          {titleIcon && <span className="text-gray-500">{titleIcon}</span>}
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        {onSearchChange !== undefined && (
          <div className="relative flex-1">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
              <SearchIcon />
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-11 w-full rounded-lg border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        )}
        {toolbar}
        {columnVisibilityKey && (
          <ColumnPicker
            columns={columns}
            hiddenColumns={hiddenColumns}
            onChange={handleHiddenChange}
            onReset={handleReset}
            open={pickerOpen}
            onToggle={() => setPickerOpen((v) => !v)}
          />
        )}
      </div>

      {/* Table card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-green-50">
                {visibleColumns.map((col) => (
                  <th
                    key={col.key}
                    className={[
                      'border-b border-gray-200 px-5 py-3.5 text-center text-sm font-semibold text-gray-700',
                      col.headerClassName ?? '',
                    ].join(' ')}
                  >
                    {col.header}
                  </th>
                ))}
                {showActions && (
                  <th className="border-b border-gray-200 px-5 py-3.5 text-center text-sm font-semibold text-gray-700">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {isError ? (
                <tr>
                  <td colSpan={colCount} className="px-5 py-10 text-center text-sm">
                    <p className="font-medium text-red-500">
                      {errorMessage ?? 'Failed to load data.'}
                    </p>
                  </td>
                </tr>
              ) : isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100">
                    {Array.from({ length: colCount }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <div className="h-4 animate-pulse rounded bg-gray-100" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-5 py-16 text-center text-sm text-gray-400"
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="border-b border-gray-100 transition-colors last:border-0 hover:bg-gray-50/60"
                  >
                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={[
                          'px-5 py-4 text-center text-sm text-gray-600',
                          col.cellClassName ?? '',
                        ].join(' ')}
                      >
                        {renderCell(col, row)}
                      </td>
                    ))}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
            <p className="text-xs text-gray-500">
              Showing{' '}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.pageSize + 1}–
                {Math.min(pagination.page * pagination.pageSize, pagination.totalCount)}
              </span>{' '}
              of <span className="font-medium">{pagination.totalCount}</span> results
            </p>
            <div className="flex items-center gap-1">
              <PaginationButton
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
              >
                ‹
              </PaginationButton>
              {buildPages(pagination.page, pagination.totalPages).map((p, i) =>
                p === '…' ? (
                  <span key={`e${i}`} className="px-1 text-xs text-gray-400">
                    …
                  </span>
                ) : (
                  <PaginationButton
                    key={p}
                    onClick={() => pagination.onPageChange(p as number)}
                    active={p === pagination.page}
                  >
                    {p}
                  </PaginationButton>
                ),
              )}
              <PaginationButton
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}
              >
                ›
              </PaginationButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildPages(current: number, total: number): (number | '…')[] {
  const pages = Array.from({ length: total }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === total || Math.abs(p - current) <= 1,
  );
  return pages.reduce<(number | '…')[]>((acc, p, i, arr) => {
    if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('…');
    acc.push(p);
    return acc;
  }, []);
}

function PaginationButton({
  children,
  onClick,
  disabled,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={[
        'min-w-[2rem] rounded px-2 py-1 text-xs font-medium transition-colors',
        'disabled:pointer-events-none disabled:opacity-40',
        active ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ColumnsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="3" width="7" height="18" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors. If errors appear, fix them before continuing.

- [ ] **Step 3: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/shared/ui/DataTable/DataTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: add column visibility to DataTable"
```

---

## Task 2: Migrate RoleTable to DataTable

**Files:**
- Modify: `src/modules/role/ui/RoleTable.tsx`

- [ ] **Step 1: Replace imports**

Change the import block at the top of the file from:
```tsx
import {
  Th,
  ActionBtn,
  PageBtn,
  buildPages,
  StatusBadge,
  PlusIcon,
  EyeIcon,
  TrashIcon,
} from '@/shared/ui/TableHelpers';
```
To:
```tsx
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
import { EyeIcon, TrashIcon, PlusIcon } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, just before the return statement**

Add this block right before `return (`:

```tsx
  const columns: ColumnDef<Role>[] = [
    {
      key: 'name',
      header: 'Name',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-400">
            <ShieldIcon />
          </span>
          <div>
            <p className="font-medium text-gray-900">{r.name}</p>
            {r.description && (
              <p className="text-xs text-gray-400 line-clamp-1">{r.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'roleType',
      header: 'Type',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (r) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            ROLE_TYPE_COLORS[r.roleType] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {r.roleType}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: 'Permissions',
      type: 'custom',
      cell: (r) => (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {r.permissions.length}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (r) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
          ].join(' ')}
        >
          {r.isActive ? 'Active' : 'Inactive'}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<Role>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewItem },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteItem, variant: 'danger' },
  ];
```

- [ ] **Step 3: Replace the JSX block inside the outer fragment**

Replace everything from `<div className="flex flex-col gap-5">` (the first div in the fragment, containing the page header, toolbar, and table) down to its closing `</div>` — but keep the two `<Modal>` elements after it — with:

```tsx
      <DataTable<Role>
        title="Roles Management"
        titleIcon={<ShieldIcon />}
        subtitle="Define roles and assign permissions to control access across the system"
        columns={columns}
        data={rows}
        rowKey={(r) => r.id}
        rowActions={rowActions}
        toolbar={
          <Link
            href={ROUTES.rolesNew}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            Create Role
          </Link>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No roles found."
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                pageSize: meta.pageSize,
                totalCount: meta.totalCount,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        columnVisibilityKey="roles"
      />
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/role/ui/RoleTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate RoleTable to DataTable with column visibility"
```

---

## Task 3: Migrate OrganizationTable to DataTable

**Files:**
- Modify: `src/modules/organization/ui/OrganizationTable.tsx`

- [ ] **Step 1: Replace imports**

Change the import block from:
```tsx
import {
  Th,
  Field,
  StatusBadge,
  ActionBtn,
  PageBtn,
  buildPages,
  SearchIcon,
  PlusIcon,
  DownloadIcon,
  EyeIcon,
  EditIcon,
  TrashIcon,
} from '@/shared/ui/TableHelpers';
```
To:
```tsx
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
import { EyeIcon, EditIcon, TrashIcon, PlusIcon, DownloadIcon } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, before the return statement**

```tsx
  const columns: ColumnDef<Organization>[] = [
    {
      key: 'organization',
      header: 'Organization',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (org) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-400">
            <Building2 size={16} />
          </span>
          <p className="font-medium text-gray-900">{org.organizationName}</p>
        </div>
      ),
    },
    {
      key: 'address',
      header: 'Address',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (org) => (
        <div>
          <p className="text-gray-700">{org.address}</p>
          <p className="mt-0.5 text-xs text-gray-500">{org.city}, {org.state} {org.postalCode}</p>
          <p className="mt-0.5 text-xs text-gray-500">{org.country}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (org) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            org.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
          ].join(' ')}
        >
          {org.status}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (org) => (
        <div className="space-y-0.5 text-xs text-gray-600">
          {org.phone && <p>📞 {org.phone}</p>}
          {org.email && <p>✉ {org.email}</p>}
          {org.website && <p>🌐 {org.website}</p>}
        </div>
      ),
    },
    {
      key: 'primaryContact',
      header: 'Primary Contact',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (org) => (
        <div className="space-y-0.5 text-xs text-gray-600">
          {org.primaryName && <p className="font-medium text-gray-800">{org.primaryName}</p>}
          {org.primaryPhone && <p>{org.primaryPhone}</p>}
          {org.primaryEmail && <p>{org.primaryEmail}</p>}
        </div>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      type: 'custom',
      cell: (org) => (
        <span className="text-xs text-gray-500">{org.createdAt.toISOString().slice(0, 10)}</span>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      type: 'custom',
      cell: (org) => (
        <span className="text-xs text-gray-500">{org.updatedAt.toISOString().slice(0, 10)}</span>
      ),
    },
  ];

  const rowActions: RowAction<Organization>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewOrg },
    { label: 'Edit', icon: <EditIcon />, onClick: setEditOrg },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteOrg, variant: 'danger' },
  ];
```

- [ ] **Step 3: Replace the JSX block inside the outer fragment**

Replace everything from the first `<div className="flex flex-col gap-5">` down to its closing `</div>` — keep the `<Modal>` elements — with:

```tsx
      <DataTable<Organization>
        title="Organizations Management"
        titleIcon={<Building2 size={22} />}
        subtitle="View and manage all organizations with Excel-like filtering and customization"
        columns={columns}
        data={rows}
        rowKey={(org) => org.id}
        rowActions={rowActions}
        searchPlaceholder="Search by name, address, email, phone, website..."
        onSearchChange={setSearch}
        toolbar={
          <>
            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
            >
              <PlusIcon />
              Create Organization
            </button>
            <button className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
              <DownloadIcon />
              Export
            </button>
          </>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No organizations found."
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                pageSize: meta.pageSize,
                totalCount: meta.totalCount,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        columnVisibilityKey="organizations"
      />
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/organization/ui/OrganizationTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate OrganizationTable to DataTable with column visibility"
```

---

## Task 4: Migrate PurchaseOrderTable to DataTable

**Files:**
- Modify: `src/modules/purchase-order/ui/PurchaseOrderTable.tsx`

The PO table has conditional row actions (Confirm + Delete only for draft). These are implemented as a `type: 'custom'` actions column since `rowActions` renders uniformly across all rows.

- [ ] **Step 1: Replace imports**

Remove `Th`, `ActionBtn`, `PageBtn`, `buildPages` from the TableHelpers import. The updated import:
```tsx
import { DataTable, type ColumnDef } from '@/shared/ui/DataTable';
import { ActionBtn, EyeIcon, TrashIcon, PlusIcon, CheckIcon, Spinner } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, before the return statement**

```tsx
  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      key: 'poNumber',
      header: 'PO #',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (po) => (
        <span className="font-mono text-sm font-medium text-blue-600">{po.poNumber}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (po) => po.customerName,
    },
    {
      key: 'supplierName',
      header: 'Supplier',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (po) => po.supplierName ?? null,
    },
    {
      key: 'warehouseName',
      header: 'Warehouse',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (po) => po.warehouseName,
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (po) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            STATUS_COLORS[po.status] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {po.status}
        </span>
      ),
    },
    {
      key: 'lineCount',
      header: 'Lines',
      type: 'custom',
      cell: (po) => <span className="text-sm text-gray-600">{po.lineCount}</span>,
    },
    {
      key: 'expectedDate',
      header: 'Expected Date',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (po) => (
        <span className="text-sm text-gray-500">
          {po.expectedDate ? new Date(po.expectedDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'custom',
      cell: (po) => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn label="View" onClick={() => handleView(po)}>
            <EyeIcon />
          </ActionBtn>
          {po.status === 'draft' && (
            <ActionBtn label="Confirm" onClick={() => confirmMutation.mutate(po.id)}>
              {confirmMutation.isPending && confirmMutation.variables === po.id ? (
                <Spinner />
              ) : (
                <CheckIcon />
              )}
            </ActionBtn>
          )}
          {po.status === 'draft' && (
            <ActionBtn label="Delete" onClick={() => setDeleteTarget(po)} danger>
              <TrashIcon />
            </ActionBtn>
          )}
        </div>
      ),
    },
  ];
```

- [ ] **Step 3: Replace the JSX block inside the outer fragment**

Replace everything from the first `<div className="flex flex-col gap-5">` down to its closing `</div>` with:

```tsx
      <DataTable<PurchaseOrder>
        title="Purchase Orders"
        subtitle="Track and manage inbound purchase orders"
        columns={columns}
        data={rows}
        rowKey={(po) => po.id}
        toolbar={
          <Link
            href={ROUTES.purchaseOrdersNew}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            New PO
          </Link>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No purchase orders found."
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                pageSize: meta.pageSize,
                totalCount: meta.totalCount,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        columnVisibilityKey="purchase-orders"
      />
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/purchase-order/ui/PurchaseOrderTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate PurchaseOrderTable to DataTable with column visibility"
```

---

## Task 5: Migrate ShipperTable to DataTable

**Files:**
- Modify: `src/modules/shipper/ui/ShipperTable.tsx`

- [ ] **Step 1: Replace imports**

```tsx
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
import { EyeIcon, EditIcon, TrashIcon, PlusIcon } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, before the return statement**

```tsx
  const columns: ColumnDef<Shipper>[] = [
    {
      key: 'name',
      header: 'Name',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (s) => (
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-400">
            <ShipperIcon />
          </span>
          <div>
            <p className="font-medium text-gray-900">{s.name}</p>
            <p className="text-xs text-gray-400">ID: {s.id.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (s) => s.code ?? null,
    },
    {
      key: 'contactName',
      header: 'Contact',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (s) => s.contactName ?? null,
    },
    {
      key: 'contactEmail',
      header: 'Email',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (s) => s.contactEmail ?? null,
    },
    {
      key: 'contactPhone',
      header: 'Phone',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (s) => s.contactPhone ?? null,
    },
  ];

  const rowActions: RowAction<Shipper>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewItem },
    { label: 'Edit', icon: <EditIcon />, onClick: setEditItem },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteItem, variant: 'danger' },
  ];
```

- [ ] **Step 3: Replace the JSX block inside the outer fragment**

Replace from the first `<div className="flex flex-col gap-5">` down to its closing `</div>` with:

```tsx
      <DataTable<Shipper>
        title="Shippers"
        subtitle="Manage carriers and shipping partners"
        columns={columns}
        data={rows}
        rowKey={(s) => s.id}
        rowActions={rowActions}
        toolbar={
          <Link
            href={ROUTES.shippersNew}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            Create Shipper
          </Link>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No shippers found."
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                pageSize: meta.pageSize,
                totalCount: meta.totalCount,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        columnVisibilityKey="shippers"
      />
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/shipper/ui/ShipperTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate ShipperTable to DataTable with column visibility"
```

---

## Task 6: Migrate LocationTable to DataTable

**Files:**
- Modify: `src/modules/location/ui/LocationTable.tsx`

The LocationTable has a bulk-select checkbox column. Since the checkbox header is a React node (not a string), `DataTable` already supports this via `header: React.ReactNode`.

- [ ] **Step 1: Replace imports**

```tsx
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
import { EyeIcon, EditIcon, TrashIcon, PlusIcon } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, before the return statement**

```tsx
  const columns: ColumnDef<Location>[] = [
    {
      key: 'select',
      header: (
        <input
          type="checkbox"
          checked={allSelected}
          onChange={() => toggleAll(rows)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
      headerClassName: 'w-10',
      type: 'custom',
      cell: (loc) => (
        <input
          type="checkbox"
          checked={selectedIds.has(loc.id)}
          onChange={() => toggleSelect(loc.id)}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'locationId',
      header: 'Location ID',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (loc) => (
        <div className="flex items-center gap-2">
          <span className="text-red-400"><PinIcon /></span>
          <span className="font-medium text-gray-900">{getDisplayId(loc)}</span>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (loc) => (
        <span className="text-gray-600">{TYPE_LABELS[loc.locationType]}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (loc) => <StatusBadge isActive={loc.isActive} />,
    },
    {
      key: 'pickable',
      header: 'Pickable',
      type: 'custom',
      cell: (loc) => <PickableBadge nonPickable={loc.nonPickable} />,
    },
  ];

  const rowActions: RowAction<Location>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewItem },
    { label: 'Edit', icon: <EditIcon />, onClick: setEditItem },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteItem, variant: 'danger' },
  ];
```

Note: `StatusBadge` here refers to the component already defined within `LocationTable.tsx` (it takes `isActive` prop). Do not import `StatusBadge` from DataTable.

- [ ] **Step 3: Replace the inner table section**

The LocationTable has an unusual structure: a title inside the table card div, separate from the page title. Find the block starting with `{/* Table card */}` (the `<div className="overflow-hidden rounded-xl ...">` containing the title + table) and replace it with:

```tsx
        <DataTable<Location>
          title={tableTitle}
          columns={columns}
          data={rows}
          rowKey={(loc) => loc.id}
          rowActions={rowActions}
          isLoading={isLoading}
          isError={isError}
          errorMessage={error instanceof Error ? error.message : undefined}
          emptyMessage="No locations found."
          pagination={
            meta && meta.totalPages > 1
              ? {
                  page: meta.page,
                  pageSize: meta.pageSize,
                  totalCount: meta.totalCount,
                  totalPages: meta.totalPages,
                  onPageChange: setPage,
                }
              : undefined
          }
          columnVisibilityKey="locations"
        />
```

Keep all toolbar/filter/import controls outside of `DataTable`, in the wrapper div they currently live in.

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/location/ui/LocationTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate LocationTable to DataTable with column visibility"
```

---

## Task 7: Migrate UserTable to DataTable

**Files:**
- Modify: `src/modules/user/ui/UserTable.tsx`

- [ ] **Step 1: Replace imports**

```tsx
import { DataTable, type ColumnDef, type RowAction } from '@/shared/ui/DataTable';
import { EyeIcon, EditIcon, TrashIcon, PlusIcon } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, before the return statement**

```tsx
  const columns: ColumnDef<User>[] = [
    {
      key: 'fullName',
      header: 'Full Name',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-600">
            {u.firstName[0]}{u.lastName[0]}
          </span>
          <div>
            <p className="font-medium text-gray-900">{u.fullName}</p>
            <p className="text-xs text-gray-400">ID: {u.id.slice(0, 8)}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (u) => u.email,
    },
    {
      key: 'userType',
      header: 'Type',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (u) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
            TYPE_COLORS[u.userType] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {u.userType}
        </span>
      ),
    },
    {
      key: 'roleId',
      header: 'Role',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (u) => (
        <span className="text-sm text-gray-600">
          {u.roleId ? u.roleId.slice(0, 8) + '…' : '-'}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (u) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize',
            STATUS_COLORS[u.status] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {u.status}
        </span>
      ),
    },
    {
      key: 'lastLoginAt',
      header: 'Last Login',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (u) => (
        <span className="text-sm text-gray-600">
          {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
  ];

  const rowActions: RowAction<User>[] = [
    { label: 'View', icon: <EyeIcon />, onClick: setViewItem },
    { label: 'Edit', icon: <EditIcon />, onClick: setEditItem },
    { label: 'Delete', icon: <TrashIcon />, onClick: setDeleteItem, variant: 'danger' },
  ];
```

- [ ] **Step 3: Replace the JSX block inside the outer fragment**

Replace from the first `<div className="flex flex-col gap-5">` down to its closing `</div>` with:

```tsx
      <DataTable<User>
        title="Users"
        subtitle="Manage system users and their access"
        columns={columns}
        data={rows}
        rowKey={(u) => u.id}
        rowActions={rowActions}
        toolbar={
          <Link
            href={ROUTES.usersNew}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            Create User
          </Link>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No users found."
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                pageSize: meta.pageSize,
                totalCount: meta.totalCount,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        columnVisibilityKey="users"
      />
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/user/ui/UserTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate UserTable to DataTable with column visibility"
```

---

## Task 8: Migrate ReturnTable to DataTable

**Files:**
- Modify: `src/modules/return/ui/ReturnTable.tsx`

Like PurchaseOrderTable, ReturnTable has conditional row actions (Archive / Delete depend on status). These are handled via a `type: 'custom'` actions column.

- [ ] **Step 1: Replace imports**

```tsx
import { DataTable, type ColumnDef } from '@/shared/ui/DataTable';
import { ActionBtn, EyeIcon, TrashIcon, PlusIcon, Spinner } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 2: Add columns array inside the component function, before the return statement**

```tsx
  const columns: ColumnDef<Return>[] = [
    {
      key: 'rmaNumber',
      header: 'RMA #',
      type: 'custom',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      cell: (ret) => (
        <span className="font-mono text-sm font-medium text-blue-600">{ret.rmaNumber}</span>
      ),
    },
    {
      key: 'customerName',
      header: 'Customer',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'text',
      accessor: (ret) => ret.customerName,
    },
    {
      key: 'returnType',
      header: 'Type',
      type: 'custom',
      cell: (ret) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
            TYPE_COLORS[ret.returnType] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {TYPE_LABELS[ret.returnType] ?? ret.returnType}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      type: 'custom',
      cell: (ret) => (
        <span
          className={[
            'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
            STATUS_COLORS[ret.status] ?? 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {ret.status}
        </span>
      ),
    },
    {
      key: 'shipperCarrier',
      header: 'Shipper/Carrier',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (ret) => (
        <span className="text-sm text-gray-700">{ret.shipperName ?? ret.carrier ?? '—'}</span>
      ),
    },
    {
      key: 'lineCount',
      header: 'Lines',
      type: 'custom',
      cell: (ret) => <span className="text-sm text-gray-600">{ret.lineCount}</span>,
    },
    {
      key: 'expectedDate',
      header: 'Expected',
      headerClassName: 'text-left',
      cellClassName: 'text-left',
      type: 'custom',
      cell: (ret) => (
        <span className="text-sm text-gray-500">
          {ret.expectedDate ? new Date(ret.expectedDate).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      type: 'custom',
      cell: (ret) => (
        <div className="flex items-center justify-center gap-1">
          <ActionBtn label="View" onClick={() => handleView(ret)}>
            <EyeIcon />
          </ActionBtn>
          {ret.status === 'processed' && !ret.isArchived && (
            <ActionBtn label="Archive" onClick={() => archiveMutation.mutate(ret.id)}>
              {archiveMutation.isPending && archiveMutation.variables === ret.id ? (
                <Spinner />
              ) : (
                <ArchiveIcon />
              )}
            </ActionBtn>
          )}
          {ret.status === 'pending' && (
            <ActionBtn label="Delete" onClick={() => setDeleteTarget(ret)} danger>
              <TrashIcon />
            </ActionBtn>
          )}
        </div>
      ),
    },
  ];
```

- [ ] **Step 3: Replace the JSX block inside the outer fragment**

Replace from the first `<div className="flex flex-col gap-5">` down to its closing `</div>` with:

```tsx
      <DataTable<Return>
        title="Returns"
        subtitle="Track and process inbound return merchandise authorizations"
        columns={columns}
        data={rows}
        rowKey={(ret) => ret.id}
        toolbar={
          <Link
            href={ROUTES.returnsNew}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            New Return
          </Link>
        }
        isLoading={isLoading}
        isError={isError}
        errorMessage={error instanceof Error ? error.message : undefined}
        emptyMessage="No returns found."
        pagination={
          meta && meta.totalPages > 1
            ? {
                page: meta.page,
                pageSize: meta.pageSize,
                totalCount: meta.totalCount,
                totalPages: meta.totalPages,
                onPageChange: setPage,
              }
            : undefined
        }
        columnVisibilityKey="returns"
      />
```

- [ ] **Step 4: Type-check**

```bash
cd /Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git -C /Users/sharipov/roadTrackApp/borderworx add borderworxWMSFrontend/src/modules/return/ui/ReturnTable.tsx
git -C /Users/sharipov/roadTrackApp/borderworx commit -m "feat: migrate ReturnTable to DataTable with column visibility"
```
