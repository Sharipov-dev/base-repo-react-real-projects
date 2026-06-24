# Table Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Export button to the shared `DataTable` that opens a modal (file name, format CSV/XLSX, scope page/all) and downloads the visible columns of the Organizations table as a file.

**Architecture:** Pure file-generation utilities live in `src/shared/lib/export/` (no React). The shared `DataTable` owns the Export button, the `ExportModal`, and the data-assembly/download logic — activated per table by an `exportFileBaseName` prop, mirroring how `columnVisibilityKey` activates column visibility. Each column declares its export value via a new optional `exportValue` field on `ColumnDef`. Organizations is the first (and only) table wired up in this task.

**Tech Stack:** Next.js 15 (App Router), TypeScript (strict), React, Tailwind, `xlsx` (SheetJS) for Excel, React Query (already in the table).

## Global Constraints

Copied from `borderworxWMSFrontend/CLAUDE.md` — every task must obey these:

- No `any` types. No `as Type` assertions on API data. (Runtime-checked `!` after a `.filter()` guard is acceptable.)
- All cross-layer imports use the `@/` path alias. Same-directory imports use `./` (matches existing `DataTable.tsx` importing `./StatusBadge`).
- No `console.log` in production code.
- `shared/` may import only external packages and other `shared/` code — never domain/modules code. (`xlsx` is an external package; OK.)
- Export public symbols from the relevant `index.ts` barrel.
- Package manager is **npm** (`package-lock.json` present).
- All work is in the frontend repo: `/Users/sharipov/roadTrackApp/borderworx/borderworxWMSFrontend`. Run all commands from there.
- There are **no automated tests** for this feature (per user). Verification = `npm run build` (type-check) + manual browser check.

---

### Task 1: Install the `xlsx` dependency

**Files:**
- Modify: `package.json`, `package-lock.json` (via npm)

- [ ] **Step 1: Install xlsx**

Run from `borderworxWMSFrontend`:

```bash
npm install xlsx
```

- [ ] **Step 2: Verify it landed**

Run:

```bash
grep '"xlsx"' package.json
```

Expected: a line like `"xlsx": "^0.18.5",` (version may differ).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add xlsx dependency for table export"
```

---

### Task 2: Create the pure export utilities

**Files:**
- Create: `src/shared/lib/export/types.ts`
- Create: `src/shared/lib/export/toCsv.ts`
- Create: `src/shared/lib/export/toXlsx.ts`
- Create: `src/shared/lib/export/downloadBlob.ts`
- Create: `src/shared/lib/export/fileName.ts`
- Create: `src/shared/lib/export/index.ts`

**Interfaces:**
- Produces (consumed by Tasks 4 & 5):
  - `type CellValue = string | number`
  - `toCsvBlob(headers: string[], rows: CellValue[][]): Blob`
  - `toXlsxBlob(headers: string[], rows: CellValue[][]): Blob`
  - `downloadBlob(blob: Blob, fileName: string): void`
  - `sanitizeFileName(name: string): string`
  - `defaultExportFileName(base: string): string`

- [ ] **Step 1: Create the shared cell type**

Create `src/shared/lib/export/types.ts`:

```ts
export type CellValue = string | number;
```

- [ ] **Step 2: Create the CSV generator**

Create `src/shared/lib/export/toCsv.ts`:

```ts
import type { CellValue } from './types';

function escapeCsvField(value: CellValue): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsvBlob(headers: string[], rows: CellValue[][]): Blob {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));
  // Prepend a UTF-8 BOM (﻿) so Excel reads non-ASCII characters correctly.
  const csv = `﻿${lines.join('\r\n')}`;
  return new Blob([csv], { type: 'text/csv;charset=utf-8;' });
}
```

- [ ] **Step 3: Create the XLSX generator**

Create `src/shared/lib/export/toXlsx.ts`:

```ts
import * as XLSX from 'xlsx';
import type { CellValue } from './types';

export function toXlsxBlob(headers: string[], rows: CellValue[][]): Blob {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
```

> Note: `XLSX.write(..., { type: 'array' })` returns an `ArrayBuffer`. The `as ArrayBuffer` here is a cast on a library return type, not on API data — permitted by the constraints.

- [ ] **Step 4: Create the browser download helper**

Create `src/shared/lib/export/downloadBlob.ts`:

```ts
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 5: Create the file-name helpers**

Create `src/shared/lib/export/fileName.ts`:

```ts
export function sanitizeFileName(name: string): string {
  return name.replace(/[/\\:*?"<>|]/g, '').trim();
}

export function defaultExportFileName(base: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${base}-${stamp}`;
}
```

- [ ] **Step 6: Create the barrel**

Create `src/shared/lib/export/index.ts`:

```ts
export { toCsvBlob } from './toCsv';
export { toXlsxBlob } from './toXlsx';
export { downloadBlob } from './downloadBlob';
export { sanitizeFileName, defaultExportFileName } from './fileName';
export type { CellValue } from './types';
```

- [ ] **Step 7: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors (exits 0).

- [ ] **Step 8: Commit**

```bash
git add src/shared/lib/export
git commit -m "feat: add pure CSV/XLSX export utilities"
```

---

### Task 3: Extend `ColumnDef` with export metadata

**Files:**
- Modify: `src/shared/ui/DataTable/DataTable.tsx:8-13` (the `BaseCol` interface)

**Interfaces:**
- Produces (consumed by Tasks 5 & 6): every `ColumnDef<T>` variant gains two optional fields:
  - `exportValue?: (row: T) => string | number | null | undefined`
  - `exportHeader?: string`

- [ ] **Step 1: Make `BaseCol` generic and add the export fields**

In `src/shared/ui/DataTable/DataTable.tsx`, replace the current `BaseCol` interface (lines 8-13):

```ts
interface BaseCol {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}
```

with:

```ts
interface BaseCol<T> {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  exportValue?: (row: T) => string | number | null | undefined;
  exportHeader?: string;
}
```

- [ ] **Step 2: Point every column variant at the generic base**

Still in `DataTable.tsx`, update the five column interfaces so each extends `BaseCol<T>` instead of `BaseCol`. They currently read `extends BaseCol`; change each:

- `interface TextCol<T> extends BaseCol<T> {`
- `interface DateCol<T> extends BaseCol<T> {`
- `interface StatusCol<T> extends BaseCol<T> {`
- `interface EntityCol<T> extends BaseCol<T> {`
- `interface CustomCol<T> extends BaseCol<T> {`

(Their bodies and the `ColumnDef<T>` union below them are unchanged.)

- [ ] **Step 3: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors. (No call sites break — the new fields are optional.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/ui/DataTable/DataTable.tsx
git commit -m "feat: add exportValue/exportHeader to ColumnDef"
```

---

### Task 4: Build the `ExportModal` component

**Files:**
- Create: `src/shared/ui/DataTable/ExportModal.tsx`

**Interfaces:**
- Consumes: `Modal` from `@/shared/ui/Modal`; `defaultExportFileName` from `@/shared/lib/export` (Task 2).
- Produces (consumed by Task 5):
  - `type ExportFormat = 'csv' | 'xlsx'`
  - `type ExportScope = 'page' | 'all'`
  - `interface ExportOptions { fileName: string; format: ExportFormat; scope: ExportScope }`
  - `function ExportModal(props: ExportModalProps)` where
    `ExportModalProps = { open: boolean; onClose: () => void; baseName: string; currentPageCount: number; allCount?: number; onExport: (opts: ExportOptions) => Promise<void> }`

- [ ] **Step 1: Create the component**

Create `src/shared/ui/DataTable/ExportModal.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Modal } from '@/shared/ui/Modal';
import { defaultExportFileName } from '@/shared/lib/export';

export type ExportFormat = 'csv' | 'xlsx';
export type ExportScope = 'page' | 'all';

export interface ExportOptions {
  fileName: string;
  format: ExportFormat;
  scope: ExportScope;
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  baseName: string;
  currentPageCount: number;
  allCount?: number;
  onExport: (opts: ExportOptions) => Promise<void>;
}

export function ExportModal({
  open,
  onClose,
  baseName,
  currentPageCount,
  allCount,
  onExport,
}: ExportModalProps) {
  const [fileName, setFileName] = useState(() => defaultExportFileName(baseName));
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [scope, setScope] = useState<ExportScope>('page');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      await onExport({
        fileName: fileName.trim() || defaultExportFileName(baseName),
        format,
        scope,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Export" width="sm">
      <div className="space-y-5 px-6 py-5">
        {/* File name */}
        <div>
          <label className="block text-sm font-medium text-gray-700">File name</label>
          <div className="mt-1.5 flex items-center">
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <span className="ml-2 shrink-0 text-sm text-gray-400">.{format}</span>
          </div>
        </div>

        {/* Format */}
        <div>
          <p className="text-sm font-medium text-gray-700">Format</p>
          <div className="mt-2 flex gap-2">
            {(['csv', 'xlsx'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={[
                  'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                  format === f
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                {f === 'csv' ? 'CSV' : 'Excel (.xlsx)'}
              </button>
            ))}
          </div>
        </div>

        {/* Scope */}
        <div>
          <p className="text-sm font-medium text-gray-700">Rows to export</p>
          <div className="mt-2 space-y-2">
            <label className="flex items-center gap-2.5 text-sm text-gray-700">
              <input
                type="radio"
                name="export-scope"
                checked={scope === 'page'}
                onChange={() => setScope('page')}
                className="accent-blue-600"
              />
              Current page ({currentPageCount})
            </label>
            {allCount !== undefined && (
              <label className="flex items-center gap-2.5 text-sm text-gray-700">
                <input
                  type="radio"
                  name="export-scope"
                  checked={scope === 'all'}
                  onChange={() => setScope('all')}
                  className="accent-blue-600"
                />
                All records ({allCount})
              </label>
            )}
          </div>
        </div>

        {error && <p className="text-sm font-medium text-red-500">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 2: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/ui/DataTable/ExportModal.tsx
git commit -m "feat: add ExportModal options dialog"
```

---

### Task 5: Wire the Export button and handler into `DataTable`

**Files:**
- Modify: `src/shared/ui/DataTable/DataTable.tsx` (imports, props interface, component body, add a `DownloadIcon`)

**Interfaces:**
- Consumes: `ExportModal`, `ExportOptions` from `./ExportModal` (Task 4); `toCsvBlob`, `toXlsxBlob`, `downloadBlob`, `sanitizeFileName`, `CellValue` from `@/shared/lib/export` (Task 2); the new `exportValue`/`exportHeader` column fields (Task 3).
- Produces (consumed by Task 6): three new optional `DataTableProps<T>` fields:
  - `exportFileBaseName?: string`
  - `onExportAll?: () => Promise<T[]>`
  - `exportAllCount?: number`

- [ ] **Step 1: Add imports**

At the top of `src/shared/ui/DataTable/DataTable.tsx`, below the existing `import { StatusBadge, ... } from './StatusBadge';` line, add:

```ts
import { ExportModal, type ExportOptions } from './ExportModal';
import {
  toCsvBlob,
  toXlsxBlob,
  downloadBlob,
  sanitizeFileName,
  type CellValue,
} from '@/shared/lib/export';
```

Also update the React import on line 3 to include `useState` (already imported) — no change needed; `useState` is already there.

- [ ] **Step 2: Add the new props to `DataTableProps`**

In the `DataTableProps<T>` interface, add three fields after `onRowClick?: (row: T) => void;`:

```ts
  exportFileBaseName?: string;
  onExportAll?: () => Promise<T[]>;
  exportAllCount?: number;
```

- [ ] **Step 3: Destructure the new props**

In the `DataTable` function parameter list, add after `onRowClick,`:

```ts
  exportFileBaseName,
  onExportAll,
  exportAllCount,
```

- [ ] **Step 4: Add export modal state**

Right after the line `const [pickerOpen, setPickerOpen] = useState(false);`, add:

```ts
  const [exportOpen, setExportOpen] = useState(false);
```

- [ ] **Step 5: Add the export handler**

Immediately after the `handleReset` function (the one that calls `localStorage.removeItem`), add:

```ts
  async function handleExport(opts: ExportOptions) {
    const exportRows =
      opts.scope === 'all' && onExportAll ? await onExportAll() : data;
    const exportCols = visibleColumns.filter(
      (col) => typeof col.exportValue === 'function',
    );
    const headers = exportCols.map((col) =>
      col.exportHeader ?? (typeof col.header === 'string' ? col.header : col.key),
    );
    const matrix: CellValue[][] = exportRows.map((row) =>
      exportCols.map((col) => {
        const value = col.exportValue!(row);
        return value == null ? '' : value;
      }),
    );
    const blob =
      opts.format === 'csv' ? toCsvBlob(headers, matrix) : toXlsxBlob(headers, matrix);
    downloadBlob(blob, `${sanitizeFileName(opts.fileName)}.${opts.format}`);
  }
```

- [ ] **Step 6: Render the Export button in the toolbar**

In the toolbar `<div className="flex items-center gap-3">`, insert the Export button **before** the `{columnVisibilityKey && (<ColumnPicker ... />)}` block (i.e. right after `{toolbar}`):

```tsx
        {exportFileBaseName && (
          <button
            onClick={() => setExportOpen(true)}
            disabled={data.length === 0}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <DownloadIcon />
            Export
          </button>
        )}
```

- [ ] **Step 7: Render the ExportModal**

Just before the final closing `</div>` of the component's returned root element (after the closing `</div>` of the "Table card" block), add:

```tsx
      {exportFileBaseName && (
        <ExportModal
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          baseName={exportFileBaseName}
          currentPageCount={data.length}
          allCount={onExportAll ? exportAllCount : undefined}
          onExport={handleExport}
        />
      )}
```

- [ ] **Step 8: Add the `DownloadIcon` helper**

In the "Helpers" section near the other icon functions (e.g. after `ChevronDownIcon`), add:

```tsx
function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}
```

- [ ] **Step 9: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add src/shared/ui/DataTable/DataTable.tsx
git commit -m "feat: render Export button and modal in DataTable"
```

---

### Task 6: Wire Organizations to the new export

**Files:**
- Modify: `src/modules/organization/ui/OrganizationTable.tsx`

**Interfaces:**
- Consumes: the new `DataTable` props `exportFileBaseName`, `onExportAll`, `exportAllCount` (Task 5); the new `exportValue` column field (Task 3); `listOrganizations` (already imported).

- [ ] **Step 1: Add `exportValue` to each column**

In the `columns` array, add an `exportValue` field to each of the seven column objects (alongside their existing `cell`):

- `organization` column — add:
  ```ts
      exportValue: (org) => org.organizationName,
  ```
- `address` column — add:
  ```ts
      exportValue: (org) =>
        [org.address, [org.city, org.state, org.postalCode].filter(Boolean).join(' '), org.country]
          .filter(Boolean)
          .join(', '),
  ```
- `status` column — add:
  ```ts
      exportValue: (org) => org.status,
  ```
- `contact` column — add:
  ```ts
      exportValue: (org) => [org.phone, org.email, org.website].filter(Boolean).join(' / '),
  ```
- `primaryContact` column — add:
  ```ts
      exportValue: (org) => [org.primaryName, org.primaryPhone, org.primaryEmail].filter(Boolean).join(' / '),
  ```
- `createdAt` column — add:
  ```ts
      exportValue: (org) => org.createdAt.toISOString().slice(0, 10),
  ```
- `updatedAt` column — add:
  ```ts
      exportValue: (org) => org.updatedAt.toISOString().slice(0, 10),
  ```

- [ ] **Step 2: Add the "export all" fetcher**

Inside the `OrganizationTable` component, after the `handleUpdate` function, add:

```ts
  async function handleExportAll(): Promise<Organization[]> {
    const all = await listOrganizations(
      { page: 1, pageSize: meta?.totalCount ?? PAGE_SIZE },
      accessToken,
    );
    return all.data;
  }
```

> Note: this issues a single request with `pageSize = totalCount`. If the backend caps `pageSize` (verify during manual testing — export "All records" and confirm the row count matches the total), switch to looping pages here. `meta` is defined at line 76 (`const meta = data?.meta;`).

- [ ] **Step 3: Remove the dead Export button and pass the new props**

In the `<DataTable<Organization> ... />` JSX:

a) In the `toolbar` prop, delete the dead Export `<button>` (the one with `<DownloadIcon /> Export`), leaving only the "Create Organization" button. The `toolbar` becomes:

```tsx
        toolbar={
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            <PlusIcon />
            Create Organization
          </button>
        }
```

b) Add three props next to `columnVisibilityKey="organizations"`:

```tsx
        exportFileBaseName="organizations"
        onExportAll={handleExportAll}
        exportAllCount={meta?.totalCount}
```

- [ ] **Step 4: Remove the now-unused `DownloadIcon` import**

On the import line `import { EyeIcon, EditIcon, TrashIcon, PlusIcon, DownloadIcon } from '@/shared/ui/TableHelpers';`, remove `DownloadIcon` (it is no longer used in this file):

```ts
import { EyeIcon, EditIcon, TrashIcon, PlusIcon } from '@/shared/ui/TableHelpers';
```

- [ ] **Step 5: Type-check**

Run:

```bash
npx tsc --noEmit
```

Expected: no errors. (If it complains `DownloadIcon` is unused elsewhere, confirm it was only used in the removed button.)

- [ ] **Step 6: Commit**

```bash
git add src/modules/organization/ui/OrganizationTable.tsx
git commit -m "feat: enable CSV/XLSX export on the Organizations table"
```

---

### Task 7: Build and manual verification

**Files:** none (verification only)

- [ ] **Step 1: Production build (full type-check + lint)**

Run:

```bash
npm run build
```

Expected: build succeeds with no type or lint errors.

- [ ] **Step 2: Manual browser check**

Run `npm run dev`, open the Organizations page, and verify:

1. An **Export** button appears in the toolbar (left of the **Columns** button).
2. Clicking it opens the **Export** modal with: a file-name input defaulting to `organizations-YYYY-MM-DD`, a **CSV / Excel (.xlsx)** format toggle, and **Current page (N)** / **All records (M)** radios.
3. The `.csv` / `.xlsx` suffix next to the file-name input flips when you change the format.
4. Export → **CSV** → **Current page**: a `.csv` file downloads; opening it shows only the **currently visible** columns (hide a column via the Columns picker first, then export, and confirm it's absent), with headers matching the visible column titles.
5. Export → **Excel (.xlsx)** → **All records**: an `.xlsx` file downloads and opens in Excel/Sheets; row count matches the total record count (M), confirming the backend honored the large `pageSize` (see Task 6 Step 2 note).
6. With a non-ASCII value in a row, the CSV opens in Excel with correct characters (BOM working).
7. The Export button is **disabled** when the table is empty (e.g. search for a non-existent term).

- [ ] **Step 3: Note any deviations**

If the "All records" row count does NOT match the total, the backend caps `pageSize` — implement the page-loop in Task 6 Step 2's `handleExportAll`, rebuild, and re-verify before considering the task done.

---

## Self-Review notes

- **Spec coverage:** Export button on DataTable (Task 5) ✓; modal with file name + format + scope (Task 4) ✓; CSV + XLSX (Task 2) ✓; visible-columns-only (Task 5 `visibleColumns.filter` + `exportValue`) ✓; current-page vs all-records (Tasks 4-6) ✓; browser download only (Task 2 `downloadBlob`) ✓; Organizations first (Task 6) ✓; error handling in modal, sanitize, empty-disable, null→'' (Tasks 2, 4, 5) ✓; no automated tests ✓.
- **Type consistency:** `toCsvBlob`/`toXlsxBlob`/`downloadBlob`/`sanitizeFileName`/`defaultExportFileName`/`CellValue` names identical across Tasks 2/4/5. `ExportOptions { fileName, format, scope }` consistent across Tasks 4/5. `exportValue`/`exportHeader` consistent across Tasks 3/5/6. New `DataTable` props `exportFileBaseName`/`onExportAll`/`exportAllCount` consistent across Tasks 5/6.
- **Out of scope (unchanged):** legacy `TableHelpers.tsx` tables, email/cloud destinations, PDF/JSON, server-side generation.
