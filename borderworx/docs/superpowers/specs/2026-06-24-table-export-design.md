# Table Export — Design Spec

**Date:** 2026-06-24
**Status:** Approved
**Scope (this task):** Organizations table only. Mechanics built generically in the shared `DataTable` so future tables can opt in with minimal wiring.

## Goal

Add an **Export** button to data tables. Clicking it opens a modal where the user picks the file name, the file format, and how much data to export. Confirming downloads the file to the browser. The first table wired up is **Organizations**; the rest follow later.

## Decisions (locked)

| Question | Decision |
|---|---|
| Formats | **CSV** and **Excel (.xlsx)** |
| Data scope | User picks in the modal: **Current page** or **All records** |
| Columns | **Visible columns only** (respects the existing column-visibility feature) |
| Destination | **Browser download only** (no email/cloud in this task) |
| Automated tests | **None** for this task |
| Excel library | `xlsx` (SheetJS) |

## Existing context

- Shared generic table: `src/shared/ui/DataTable/DataTable.tsx` (used by Organizations and ~9 other tables). Column-visibility already lives here, gated by the `columnVisibilityKey` prop. The export feature follows the same "build it once in DataTable, opt in per table via a prop" pattern.
- A **dead, unwired `Export` button already exists** in the toolbar of `OrganizationTable.tsx` (and `CustomerTable.tsx`, `WarehouseTable.tsx`). This task replaces/wires the Organizations one through `DataTable`.
- Shared modal: `src/shared/ui/Modal/Modal.tsx` (custom in-house modal via `createPortal`, `width: 'sm'|'md'|'lg'|'xl'`, Escape-to-close).
- `ColumnDef<T>` is a discriminated union (`text`/`email`/`phone`/`date`/`status`/`entity`/`custom`). Organizations columns are all `type: 'custom'` with `cell: row => ReactNode`.
- Backend list endpoint accepts `pageSize` (`listOrganizations({ page, pageSize })`), and the paginated response carries `meta.total`. So "All records" needs **no backend change** — fetch with `pageSize = meta.total`.
- No CSV/Excel/download utility or dependency exists yet — this is greenfield.

## The core constraint

`DataTable` columns render JSX (`cell: row => ReactNode`), not plain values. Export needs plain string/number cell values, which cannot be reliably extracted from rendered JSX. Therefore each exportable column must declare how to produce its export value.

## Architecture

```
app/ → modules/organization/ui/OrganizationTable.tsx   (wires export props)
                     │
src/shared/ui/DataTable/
   DataTable.tsx        (Export button in toolbar + modal state + row assembly)
   ExportModal.tsx      (options dialog, built on shared Modal)
   types                (ColumnDef gains exportValue?, exportHeader?)
                     │
src/shared/lib/export/
   toCsv.ts             (rows → CSV string; quote/comma/newline escaping; UTF-8 BOM)
   toXlsx.ts            (rows → .xlsx Blob via `xlsx` SheetJS)
   downloadBlob.ts      (trigger browser download of a Blob)
   index.ts             (barrel)
```

`src/shared/lib/export/` are pure functions — no React, no domain knowledge. They take an array of plain row objects and headers, and return / download a file.

### Layer compliance

All new code sits in `src/shared/` (generic UI + utilities) and `src/modules/organization/ui/` (domain wiring). `shared/` imports nothing internal except external packages (`xlsx`). Conforms to the project's layered architecture rules.

## Column contract change

Extend `ColumnDef<T>` (in the DataTable types) with two optional fields:

```ts
exportValue?: (row: T) => string | number | null | undefined;
exportHeader?: string; // defaults to `header`
```

- Only **visible** columns that define `exportValue` are included in the export.
- Purely visual / action columns without `exportValue` are skipped.
- `exportHeader` overrides the column header text in the exported file (defaults to `header`).

For Organizations, add `exportValue` to each of its 7 columns:

| Column key | exportValue |
|---|---|
| `organization` | organization name |
| `address` | composed full address (address, city, state, country) |
| `status` | status string |
| `contact` | email and/or phone (composed) |
| `primaryContact` | primary contact name |
| `createdAt` | localized date string |
| `updatedAt` | localized date string |

(Exact composition of multi-field columns is finalized during planning against the live column definitions.)

## DataTable API additions

New optional props on `DataTableProps<T>`:

```ts
exportFileBaseName?: string;          // e.g. "organizations" → default filename "organizations-YYYY-MM-DD"
onExportAll?: () => Promise<T[]>;     // fetch every record; enables the "All records" option
```

- The Export button appears **only when `exportFileBaseName` is provided** (i.e. the table opted in). A table that opts in is expected to have at least one column with `exportValue`.
- If `onExportAll` is **not** provided, the "All records" choice is hidden/disabled and only "Current page" is offered (graceful degradation).
- "Current page" uses the already-loaded `data` prop. No refetch.

## Data flow

```
[Export button click] → ExportModal opens
  options:
    • File name   (text input, default `${exportFileBaseName}-YYYY-MM-DD`)
    • Format      (CSV | Excel .xlsx)
    • Scope       (Current page (N) | All records (M))   ← "All records" only if onExportAll exists
[Confirm]
  ├─ scope = current page → rows = data
  └─ scope = all          → rows = await onExportAll()   (spinner while loading)
  → for each row, for each VISIBLE column with exportValue:
        record[exportHeader ?? header] = exportValue(row)
  → format = CSV  → toCsv(records)  → Blob (text/csv)
     format = XLSX → toXlsx(records) → Blob (xlsx mime)
  → downloadBlob(blob, `${sanitizedName}.${ext}`)
  → close modal
```

For Organizations, `onExportAll` calls `listOrganizations({ page: 1, pageSize: meta.total })` and returns the mapped list. (Planning confirms whether the backend caps `pageSize`; if so, loop pages.)

## Modal UI

Built on the shared `Modal` (title "Export"):

- **File name** — text input. Default `${exportFileBaseName}-YYYY-MM-DD`. Extension is appended automatically from the chosen format (user does not type it).
- **Format** — segmented control / radio: `CSV` / `Excel (.xlsx)`.
- **Scope** — radio: `Current page (N)` / `All records (M)`. Second option present only when `onExportAll` exists.
- **Actions** — `Cancel` / `Export`. Export button shows a spinner while "All records" is fetching.

## Error handling & edge cases

- Empty dataset → Export button disabled (nothing to export).
- "All records" fetch fails → show an error message inside the modal; keep it open (do not download, do not close).
- Empty file-name input → fall back to the default name.
- Sanitize the file name: strip `/ \ : * ? " < > |`.
- Cell values: `null` / `undefined` → empty string. Dates formatted by the column's `exportValue`. CSV escapes quotes, commas, and newlines, and prepends a UTF-8 BOM so Excel reads non-ASCII correctly.

## Out of scope (this task)

- Tables still using the legacy `TableHelpers.tsx` markup (export rollout to those is separate).
- Email / cloud / server-side export destinations.
- PDF and JSON formats.
- Server-generated export files (all generation is client-side).
- Automated tests.

## Rollout (later, not now)

For each additional `DataTable`-based table: (1) add `exportValue` to its columns, (2) pass `exportFileBaseName` and optionally `onExportAll`. The Export button and modal then work automatically.
