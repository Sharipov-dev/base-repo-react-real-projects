# Phase 2: Export Rollout to Remaining Tables - Research

**Researched:** 2026-06-25
**Domain:** React/TypeScript frontend — applying an existing, shipped export stack to additional `DataTable`-based tables
**Confidence:** HIGH (entire surface is in-repo, verified by reading every relevant file)

## Summary

Phase 1 already built and shipped a fully generic, opt-in table-export stack inside the shared `DataTable` component, and wired it onto the Organizations table as the reference. Phase 2 is **pure repetition of a known pattern** — no new infrastructure, no new dependencies, no new utilities. For each in-scope table the work is exactly three edits: (1) add an `exportValue` callback to each column whose data should appear in the export, (2) add an `async handleExportAll()` page-loop fetcher next to the existing `handleUpdate`/data-fetch logic, and (3) pass three props to `<DataTable>` — `exportFileBaseName`, `onExportAll={handleExportAll}`, `exportAllCount={meta?.totalCount}`. The Export button + modal then appear automatically. `[VERIFIED: read DataTable.tsx, OrganizationTable.tsx]`

The single highest-value research output is the **per-table scope classification**. The phase brief names 10 target tables, but two of them are NOT built on the shared `DataTable` and are therefore OUT OF SCOPE per the Phase 1 locked decision (legacy `TableHelpers` markup gets no export): **warehouses** (`WarehouseTable.tsx` uses `<Th>`/`<ActionBtn>`/`buildPages` raw markup) and **customer contacts** (no `*Table.tsx` exists; `CustomerContactsManager.tsx` renders a raw `<table>`). That leaves **8 in-scope tables**. Wiring those 8 is the deliverable. `[VERIFIED: grep + file reads]`

**Primary recommendation:** Plan one task per in-scope table (8 tasks), each replicating the Organizations wiring verbatim, plus a build/manual-verify task. Explicitly record warehouses and customer contacts as descoped (they need a prior `DataTable` migration that is out of this milestone's scope). Watch the per-table date-type difference (some UI models expose `Date`, others `string`) and the client-side-filter tables (Locations, Items, Inventory, Transactions) when writing `handleExportAll`.

## User Constraints (from CONTEXT.md)

No CONTEXT.md exists for this phase (`/gsd-discuss-phase` was not run). Constraints are therefore inherited from the locked Phase 1 decisions in PROJECT.md and the design spec, which bind this rollout:

### Locked Decisions (from PROJECT.md Key Decisions + design spec)
- Export is **opt-in per table** via `exportFileBaseName` + per-column `exportValue` callbacks; `DataTable` owns the button/modal/handler. `[CITED: PROJECT.md]`
- "All records" export uses a **page-loop** (`EXPORT_PAGE_SIZE = 100`) to defeat backend `pageSize` caps. `[CITED: PROJECT.md + verified OrganizationTable.handleExportAll]`
- `xlsx` (SheetJS) for XLSX; CSV uses the hand-rolled escaper with UTF-8 BOM. Already installed and in use. `[CITED: PROJECT.md]`
- **Legacy `TableHelpers` tables are OUT OF SCOPE.** Only `DataTable`-based tables get export. `[CITED: PROJECT.md + design spec "Out of scope"]`
- Visible columns only; columns without `exportValue` are skipped. CSV/XLSX, browser download only. No automated tests. `[CITED: design spec]`

### Claude's Discretion
- The exact composition of multi-field / derived export values per column (e.g. how Locations composes a display ID, what the User "Role" column exports).
- Whether `handleExportAll` on filtered tables exports all backend records or only the filtered subset (see Open Questions).

### Deferred Ideas (OUT OF SCOPE)
- Migrating `WarehouseTable` and customer-contacts to `DataTable` (prerequisite for their export — separate work).
- Email/cloud/server-side export, PDF/JSON formats, automated tests.

## Phase Requirements

Requirements are TBD in the roadmap. Mapped from the Phase 2 Success Criteria:

| ID | Description | Research Support |
|----|-------------|------------------|
| SC-1 | User can export each in-scope table to CSV or Excel via the Export button | Achieved by passing `exportFileBaseName` (button appears) — verified mechanism in DataTable.tsx:353-362 |
| SC-2 | Each export respects visible columns and uses the same value formatting shown in the table | Per-column `exportValue` callbacks; `handleExport` filters to `visibleColumns` with an `exportValue` — DataTable.tsx:302-320 |
| SC-3 | "All records" export pulls every page (page-loop), not just current page | `onExportAll` page-loop pattern — verified OrganizationTable.tsx:57-73 |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Export button + modal + row/column assembly + download | `shared/ui/DataTable` (generic UI) | — | Already built generically in Phase 1; tables opt in via props |
| Per-column export value formatting | `modules/<domain>/ui/<Table>.tsx` (domain UI) | — | Column definitions are domain-specific; only the table knows its fields |
| "All records" fetch (page-loop) | `modules/<domain>/ui/<Table>.tsx` | `modules/<domain>/api/<domain>.api.ts` | Table owns the React Query data + token; calls the existing `list*` API |
| File generation (CSV/XLSX) + download | `shared/lib/export` (pure utils) | — | Pure functions, already shipped; no changes needed in Phase 2 |

**No work belongs in `services/` or `widgets/`.** Every Phase 2 edit is in `modules/<domain>/ui/*.tsx` only. No `shared/` changes are needed — the infrastructure is complete. `[VERIFIED]`

## Per-Table Scope Classification (the critical deliverable)

| # | Target (brief) | Component path (relative to `borderworxWMSFrontend/src/`) | DataTable or legacy | In scope? | Notes |
|---|----------------|-----------------------------------------------------------|---------------------|-----------|-------|
| 1 | warehouses | `modules/warehouse/ui/WarehouseTable.tsx` | **Legacy** (`<Th>`, `<ActionBtn>`, `buildPages`, raw `<table>`; imports `TableHelpers`, NOT `DataTable`) | **NO** | Out of scope per locked decision. Needs `DataTable` migration first (separate work). Has a dead `DownloadIcon` Export button. `listWarehouses({page,pageSize})` exists & paginated. |
| 2 | locations | `modules/location/ui/LocationTable.tsx` | DataTable | **YES** | Has a `select` checkbox column (no `exportValue`) + client-side warehouse/status/ID filters that shrink `rows`. Composite display ID via `getDisplayId`. `listLocations({page,pageSize})`. |
| 3 | customers | `modules/customer/ui/CustomerTable.tsx` | DataTable | **YES** | Has a **dead Export button in `toolbar`** to remove (mirrors Organizations cleanup). Client-side search filter. 5 columns. `listCustomers({page,pageSize})`. |
| 4 | customer contacts | `modules/customer-contact/ui/CustomerContactsManager.tsx` (no `*Table.tsx`) | **Legacy** (raw `<table>` at line 144; not `DataTable`) | **NO** | Out of scope. Needs `DataTable` migration first. No paginated list confirmed. |
| 5 | users | `modules/user/ui/UserTable.tsx` | DataTable | **YES** | `roleId` column shows truncated id; `lastLoginAt`/`createdAt` are ISO `string`. `listUsers({page,pageSize,search})`. |
| 6 | roles | `modules/role/ui/RoleTable.tsx` | DataTable | **YES** | `permissions` column shows `.length` (export the count or a joined list — discretion). No createdAt column shown. `listRoles({page,pageSize})`. |
| 7 | receipts | `modules/receipt/ui/ReceiptTable.tsx` | DataTable | **YES** | 7 columns; `lineCount`, `receiptDate` (ISO string). `listReceipts({page,pageSize,status})`. |
| 8 | items | `modules/item/ui/ItemTable.tsx` | DataTable | **YES** | `tracking` column is a composite of 3 booleans (SN/LOT/EXP); `status` from `isActive`. Server-side search (`listItems({page,pageSize,search})`). |
| 9 | inventory | `modules/inventory/ui/InventoryTable.tsx` | DataTable | **YES** | 9 columns; dates are ISO `string`; server-side search. `data` is inline-typed (`typeof rows[number]`) — `<DataTable>` rendered without explicit `<T>`. `listInventory({page,pageSize,search,...})`. |
| 10 | inventory transaction history | `modules/inventory/ui/InventoryTransactionsTable.tsx` | DataTable | **YES** | 8 columns; `type` mapped via `TRANSACTION_TYPE_LABELS`; `quantityChange` shows +/- sign; `createdAt` ISO string; server-side `type` filter. **The row (`InventoryTransaction`) carries ONLY `inventoryId` — NO `itemSku`/`itemName`/`locationCode` (verified `inventory/model/types.ts`); a human-readable label must be resolved via a `listInventory` lookup Map keyed by inventory `id`.** `listInventoryTransactions({page,pageSize,inventoryId,type})`. |

**Net scope: 8 tables IN, 2 OUT (warehouses, customer contacts).** `[VERIFIED: every path read or grepped]`

## The Reference Wiring (replicate verbatim per table)

Source of truth: `modules/organization/ui/OrganizationTable.tsx` + `shared/ui/DataTable/DataTable.tsx`. `[VERIFIED: full file reads 2026-06-25]`

### 1. Per-column `exportValue` (added alongside the existing `cell`)
`ColumnDef<T>` already carries `exportValue?: (row: T) => string | number | null | undefined` and `exportHeader?: string` (DataTable.tsx:21-22). Only **visible** columns whose `exportValue` is a function are exported (DataTable.tsx:305-307); header text defaults to the column `header` if it's a string, else `key` (DataTable.tsx:308-310). `null`/`undefined` → empty string (DataTable.tsx:313-314).

Organizations example (each column gets one line):
```ts
// organization name
exportValue: (org) => org.organizationName,
// composed address
exportValue: (org) =>
  [org.address, [org.city, org.state, org.postalCode].filter(Boolean).join(' '), org.country]
    .filter(Boolean).join(', '),
// date — NOTE: org.createdAt is a Date in the UI model
exportValue: (org) => org.createdAt.toISOString().slice(0, 10),
```

### 2. The all-records page-loop (`handleExportAll`)
The **actual shipped** Organizations implementation (differs from the old plan doc — it loops, it does not single-fetch):
```ts
async function handleExportAll(): Promise<Organization[]> {
  const EXPORT_PAGE_SIZE = 100;
  const all: Organization[] = [];
  let pageNum = 1;
  for (;;) {
    const result = await listOrganizations(
      { page: pageNum, pageSize: EXPORT_PAGE_SIZE },
      accessToken,
    );
    all.push(...result.data);
    if (result.data.length < EXPORT_PAGE_SIZE || all.length >= result.meta.totalCount) break;
    pageNum += 1;
  }
  return all;
}
```
`[VERIFIED: OrganizationTable.tsx:57-73]`

### 3. The three `<DataTable>` props
```tsx
exportFileBaseName="organizations"
onExportAll={handleExportAll}
exportAllCount={meta?.totalCount}
```
`[VERIFIED: OrganizationTable.tsx:225-227]`. The Export button renders only when `exportFileBaseName` is set (DataTable.tsx:353); "All records" radio shows only when `onExportAll` is set and `exportAllCount` is passed (DataTable.tsx:527). Button is disabled when `data.length === 0` (DataTable.tsx:356).

## Standard Stack

No new dependencies. The complete stack already exists. `[VERIFIED]`

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| `xlsx` (SheetJS) | installed Phase 1 | XLSX blob generation | Already wired into `toXlsxBlob` |
| `@tanstack/react-query` | in use | Data fetching in every table | Already present |
| Next.js 15 / React / TS strict / Tailwind | repo baseline | App framework | No change |

Shared export utilities (no edits in Phase 2): `shared/lib/export/{toCsv,toXlsx,downloadBlob,fileName,types,index}.ts` exporting `toCsvBlob`, `toXlsxBlob`, `downloadBlob`, `sanitizeFileName`, `defaultExportFileName`, `CellValue`. `[VERIFIED: directory listing + plan doc]`

## Architecture Patterns

### Data flow (unchanged from Phase 1)
```
[Export button] → ExportModal (filename / format / scope)
  → scope=page  → rows = data (current page, already loaded)
    scope=all   → rows = await onExportAll()  (page-loop over list API)
  → for each row × each VISIBLE col with exportValue:
        matrix[r][c] = exportValue(row)  (null/undefined → '')
  → headers = visible cols' exportHeader ?? header
  → CSV → toCsvBlob(headers, matrix) | XLSX → toXlsxBlob(headers, matrix)
  → downloadBlob(blob, `${sanitizeFileName(name)}.${format}`)
```

### Pattern: one table = three edits
Each in-scope table is independently editable. There is no shared file to touch, so the 8 tasks are fully parallelizable and carry no cross-task ordering dependency. `[VERIFIED]`

### Anti-Patterns to Avoid
- **Do NOT add `exportValue` to visual-only columns** (e.g. Locations' `select` checkbox column). They have no meaningful value and should be skipped — leaving `exportValue` off is the correct behavior.
- **Do NOT touch `shared/`.** The infra is complete; editing it risks regressing Organizations.
- **Do NOT call `.toISOString()` on a `string` date.** Only Organization/Location/Customer UI models expose `Date`; User/Receipt/Item/Role/Inventory expose ISO `string`. Use `new Date(x).toLocaleDateString()` or `x.slice(0,10)` for string fields (matching what the cell already renders). `[VERIFIED: per-model type grep]`
- **Do NOT export raw enum/code values where the cell shows a label.** SC-2 requires export to match displayed formatting (e.g. Transactions `type` → `TRANSACTION_TYPE_LABELS[tx.type]`; Locations `type` → `TYPE_LABELS[loc.locationType]`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV escaping / BOM | A new escaper | `toCsvBlob` | Already handles quotes/commas/newlines + UTF-8 BOM |
| XLSX generation | Manual XML | `toXlsxBlob` | SheetJS already wrapped |
| Browser download | New anchor logic | `downloadBlob` | Already shipped |
| Filename sanitize/default | New helper | `sanitizeFileName` / `defaultExportFileName` | Already shipped |
| Export button / modal / scope toggle | New component | `DataTable` props | Generic, already wired |

**Key insight:** Phase 2 writes ZERO new functions in `shared/`. Every per-table edit is data-shape declaration (`exportValue` callbacks) + one fetcher + three props.

## Per-Table Export-Value Notes (planner input for `exportValue` callbacks)

Derived from each table's column `cell` renderers (export must mirror what's displayed — SC-2). Date-type column shows the underlying TS type. `[VERIFIED: column defs + model types]`

- **Locations** (`Location`, dates are `Date`): `locationId` → `getDisplayId(loc)`; `type` → `TYPE_LABELS[loc.locationType]`; `barcode` → `getDisplayId(loc)`; `status` → `loc.isActive ? 'Active' : 'Inactive'`; `pickable` → `loc.nonPickable ? 'Non-pickable' : 'Pickable'`. Skip the `select` column.
- **Customers** (`Customer`): `name` → `c.name`; `email` → `c.email`; `phone` → `c.phone`; `company` → `c.alias ?? c.name`; `location` → `[c.city, c.state].filter(Boolean).join(', ') || c.country`. Remove the dead Export button from `toolbar`.
- **Users** (`User`, dates are `string`): `fullName` → `u.fullName`; `email` → `u.email`; `userType` → `u.userType`; `roleId` → `u.roleId ?? ''` (decide full id vs blank — discretion); `status` → `u.status`; `lastLoginAt` → `u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : ''`.
- **Roles** (`Role`): `name` → `r.name`; `roleType` → `r.roleType`; `permissions` → `r.permissions.length` (or `r.permissions.join('; ')` — discretion); `status` → `r.isActive ? 'Active' : 'Inactive'`.
- **Receipts** (`Receipt`, dates are `string`): `receiptNumber`, `referenceNumber` (header "Reference"), `customerName`, `warehouseName`, `status`, `lineCount`, `receiptDate` → `new Date(r.receiptDate).toLocaleDateString()`.
- **Items** (`Item`): `sku`, `name`, `category` (`item.category ?? ''`), `uom` → `item.secondaryUom ?? ''`, `tracking` → compose from booleans e.g. `[item.serialTracking&&'SN', item.lotTracking&&'LOT', item.expiryTracking&&'EXP'].filter(Boolean).join(',')`, `status` → `item.isActive ? 'Active' : 'Inactive'`.
- **Inventory** (`InventoryEntry`, dates are `string`; table rendered without explicit `<T>`): `itemSku`, `itemName`, `locationCode`, `quantity`, `allocatedQuantity`, `availableQuantity`, `lotNumber`, `expiryDate` → `entry.expiryDate ? new Date(entry.expiryDate).toLocaleDateString() : ''`, `updatedAt` → `new Date(entry.updatedAt).toLocaleDateString()`.
- **Inventory Transactions** (dates are `string`; rendered without explicit `<T>`): `type` → `TRANSACTION_TYPE_LABELS[tx.type] ?? tx.type`; `inventoryId` → the row has NO item label (only `inventoryId`), so per the LOCKED FK decision resolve `inventoryId` → `"<itemSku> — <itemName>"` via a `Map` built from `listInventory` (whose rows carry `id`+`itemSku`+`itemName`), keyed by `entry.id`; fall back to the FULL `inventoryId` (never the truncated `.slice(0,8)` value) when the id is not in the map — mirrors the Users `roleId`→`listRoles` resolution; `quantityBefore`; `quantityChange` (keep the sign as the cell does); `quantityAfter`; `reason` (`tx.reason ?? ''`); `referenceType` (`tx.referenceType ?? ''`); `createdAt` → `new Date(tx.createdAt).toLocaleString()`.

## Common Pitfalls

### Pitfall 1: Date-type mismatch
**What goes wrong:** Copying `org.createdAt.toISOString()` into a table whose date field is a `string` → TS error / runtime crash.
**How to avoid:** Check the UI model. `Date` → `.toISOString().slice(0,10)`; `string` → `new Date(x).toLocaleDateString()`. `[VERIFIED]`

### Pitfall 2: Filtered tables and `onExportAll` semantics
**What goes wrong:** Locations/Items/Inventory/Transactions apply client-side filters (Locations) or server-side filters (Items/Inventory/Transactions search/type) to the *current page*, but `handleExportAll` fetches **all backend records ignoring those filters** (as the Organizations reference does — it page-loops the unfiltered list). A user who filtered to "type=receive" and chose "All records" will get every transaction, not just receives.
**How to avoid:** Decide and document the intended behavior (see Open Questions). The simplest, reference-consistent choice is "All records = entire dataset, ignoring filters"; "Current page" already respects what's shown. If filtered-all is desired, `handleExportAll` must thread the active filter into the `list*` call.

### Pitfall 3: Inline-typed tables (Inventory, Transactions)
**What goes wrong:** These render `<DataTable>` without an explicit `<T>` and type columns as `ColumnDef<typeof rows[number]>`. A `handleExportAll` returning a concrete type must match the inferred row type or TS infers `onExportAll: () => Promise<T[]>` incorrectly.
**How to avoid:** Either add the explicit generic (`<DataTable<InventoryEntry>>`) or have `handleExportAll` return the same type `listInventory(...).data` produces. Verify with `npx tsc --noEmit`. `[VERIFIED: InventoryTable.tsx:37, 115]`

### Pitfall 4: Forgetting to remove dead Export buttons
**What goes wrong:** Customers (and possibly others) have a dead `<button><DownloadIcon/>Export</button>` in their `toolbar`. Leaving it produces two Export buttons.
**How to avoid:** Remove the dead toolbar Export button exactly as the Organizations cleanup did (and drop the now-unused `DownloadIcon` import if nothing else uses it). `[VERIFIED: CustomerTable.tsx:149-152]`

### Pitfall 5: `exportAllCount` from the wrong field
**What goes wrong:** Using `meta.total` (does not exist) instead of `meta.totalCount`.
**How to avoid:** All modules use `meta.totalCount` / `meta.totalPages`. `[VERIFIED: per-module Paginated* types]`

## Runtime State Inventory

Not applicable — this is a greenfield-feature rollout (additive code edits in domain UI files), not a rename/refactor/migration. No stored data, service config, OS state, secrets, or build artifacts are affected. `localStorage` column-visibility keys already exist per table and are unrelated to export.

## Environment Availability

No external dependencies introduced. `xlsx` already installed; all list APIs already exist and are paginated. Verification tooling (`npm run build`, `npx tsc --noEmit`, `npm run dev`) is the existing toolchain. Step 2.6: no missing dependencies, no fallbacks needed.

## Validation Architecture

Per the design spec and PROJECT.md, this feature has **no automated tests** (locked decision). `nyquist_validation` config was not located; the established project convention for this milestone is build + manual browser verification. Treat the validation gate as:

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None for this feature (locked: "no automated tests") |
| Quick run command | `npx tsc --noEmit` (type-check) |
| Full suite command | `npm run build` (type-check + lint + production build) |

### Phase Requirements → Verification Map
| Req | Behavior | Type | Command / Method |
|-----|----------|------|------------------|
| SC-1 | Export button appears + opens modal per table | manual | `npm run dev`, visit each of 8 pages |
| SC-2 | Export matches visible columns & displayed formatting | manual | hide a column, export, open file |
| SC-3 | "All records" pulls every page | manual | export All, confirm row count == `meta.totalCount` |
| (all) | No type/lint regressions | automated | `npm run build` |

### Wave 0 Gaps
None — no test infrastructure to scaffold (per locked no-tests decision). If the planner wants a regression guard, the only available gate is `npm run build` after each table.

## Code Examples

### Adding export to a string-date table (e.g. Receipts)
```tsx
// 1. in the columns array, add exportValue alongside each cell:
{ key: 'receiptNumber', header: 'Receipt #', type: 'custom', /* ... */,
  exportValue: (r) => r.receiptNumber, cell: (r) => /* ... */ },
{ key: 'date', header: 'Date', type: 'custom', /* ... */,
  exportValue: (r) => new Date(r.receiptDate).toLocaleDateString(),
  cell: (r) => /* ... */ },

// 2. add the fetcher (mirror OrganizationTable):
async function handleExportAll(): Promise<Receipt[]> {
  const EXPORT_PAGE_SIZE = 100;
  const all: Receipt[] = [];
  let pageNum = 1;
  for (;;) {
    const result = await listReceipts({ page: pageNum, pageSize: EXPORT_PAGE_SIZE }, accessToken);
    all.push(...result.data);
    if (result.data.length < EXPORT_PAGE_SIZE || all.length >= result.meta.totalCount) break;
    pageNum += 1;
  }
  return all;
}

// 3. add three props on <DataTable>:
exportFileBaseName="receipts"
onExportAll={handleExportAll}
exportAllCount={meta?.totalCount}
```
`[VERIFIED: pattern from OrganizationTable.tsx; signatures from receipt.api.ts]`

## State of the Art

| Old Approach (plan doc) | Current Approach (shipped) | Impact |
|-------------------------|----------------------------|--------|
| `handleExportAll` = single fetch with `pageSize = totalCount` | Page-loop with `EXPORT_PAGE_SIZE = 100` | The shipped Organizations code already loops; replicate the loop, not the single-fetch from the old plan doc. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Customer contacts" target maps to `CustomerContactsManager.tsx` (the only contacts UI; no `*Table.tsx`) and is legacy/out-of-scope | Scope table | If a different contacts table is intended, scope count changes. Low risk — verified no other contacts table exists. |
| A2 | Filtered tables should export the *entire* dataset on "All records" (ignoring active filters), matching the Organizations reference | Pitfall 2 / Open Q | If product wants filtered-all, `handleExportAll` needs filter threading. Medium — UX decision. |
| A3 | No CONTEXT.md / no `nyquist_validation` config means manual+build verification is the gate | Validation | If automated tests are later required, plan needs a test task. Low — locked no-tests decision. |

## Open Questions

1. **Should "All records" respect active table filters?**
   - Known: Locations (client-side warehouse/status/ID filters), Items/Inventory (server search), Transactions (server `type` filter) all filter the visible page. The Organizations reference page-loops the *unfiltered* list.
   - Unclear: Whether users expect "All records" to mean "all I've filtered to" or "everything."
   - Recommendation: Default to reference-consistent (export everything; "Current page" already reflects the filtered view). Flag for the planner/user to confirm; threading filters is a small per-table change if desired.

2. **Users `roleId` and Transactions `inventoryId` export value — full id or truncated/blank?**
   - The cells show truncated ids (`.slice(0,8)…`). Exporting truncated ids is useless for re-import; full id or a resolved name is better.
   - Recommendation: Export the full id (or omit `exportValue` on `roleId` if it carries no analytical value). Planner's discretion per SC-2 latitude.

3. **Are warehouses / customer-contacts expected to be delivered this phase?**
   - The brief lists 10 tables but the locked decision excludes legacy tables. Recommendation: explicitly descope both in the plan and note they require a prior `DataTable` migration (out of milestone). Surface to the user so the 10→8 reduction is a conscious decision, not a silent drop.

## Sources

### Primary (HIGH confidence — all in-repo, read 2026-06-25)
- `borderworxWMSFrontend/src/shared/ui/DataTable/DataTable.tsx` — export props, button, modal, `handleExport`
- `borderworxWMSFrontend/src/modules/organization/ui/OrganizationTable.tsx` — reference wiring + page-loop
- All 8 in-scope table components + `WarehouseTable.tsx` + `CustomerContactsManager.tsx` (scope classification)
- All `modules/*/api/*.api.ts` list signatures + `modules/*/model/types.ts` (field/date types, `meta.totalCount`)
- `docs/superpowers/specs/2026-06-24-table-export-design.md`, `docs/superpowers/plans/2026-06-24-table-export.md`
- `.planning/{PROJECT,ROADMAP,STATE}.md`; `borderworxWMSFrontend/CLAUDE.md`

## Project Constraints (from CLAUDE.md)

`borderworxWMSFrontend/CLAUDE.md` directives the planner must enforce (export work touches only `modules/*/ui`):
- No `any`; no `as Type` on API data; strict TS. Runtime `!` after a guard is acceptable.
- All cross-layer imports use `@/`; same-directory uses `./`. No `../../` traversals.
- No `console.log` in production code.
- `shared/` imports nothing internal — **but Phase 2 makes no `shared/` edits.**
- Package manager is **npm**.
- "Do not refactor surrounding code"; "do not add features beyond what was requested"; "do not add comments to code you did not modify." → keep each table edit minimal: `exportValue` lines, one fetcher, three props, remove dead Export button only where present.
- Verification = `npm run build` (type-check + lint). Run from `borderworxWMSFrontend`.

## Metadata

**Confidence breakdown:**
- Scope classification: HIGH — every component path read or grepped; legacy-vs-DataTable confirmed by markup inspection.
- Wiring pattern: HIGH — reference and DataTable read in full; page-loop verified in shipped code.
- Per-column export values: HIGH — derived directly from each column's `cell` + model types.
- Filter/date pitfalls: HIGH — confirmed against types and per-table filter logic.
- Validation approach: MEDIUM — no test config found; relies on locked no-tests decision + build gate.

**Research date:** 2026-06-25
**Valid until:** 2026-07-25 (stable; in-repo, no fast-moving external deps)
