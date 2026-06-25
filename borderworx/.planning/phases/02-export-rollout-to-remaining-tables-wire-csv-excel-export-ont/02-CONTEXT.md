# Phase 2: Export Rollout to DataTable Tables - Context

**Gathered:** 2026-06-25
**Status:** Ready for planning
**Source:** Decisions captured during /gsd-plan-phase 2 (post-research)

<domain>
## Phase Boundary

Wire the existing Phase 1 export stack onto the **8 DataTable-based tables**:
locations, customers, users, roles, receipts, items, inventory, inventory transactions.

Each table gets exactly three edits (no new `shared/` code):
1. Per-column `exportValue` (and `exportHeader` where the display header differs) callbacks.
2. An `async handleExportAll()` that page-loops (EXPORT_PAGE_SIZE pattern) to fetch all rows.
3. Pass `exportFileBaseName` + `onExportAll` + `exportAllCount` to `<DataTable>`.

Reference implementation to replicate verbatim: `OrganizationTable.tsx`.

**OUT OF SCOPE (deferred to Phase 3):** warehouses (`WarehouseTable.tsx`, legacy `TableHelpers`)
and customer contacts (`CustomerContactsManager.tsx`, raw `<table>`). They are not DataTable-based
and need a DataTable migration first.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Scope
- Phase 2 delivers the 8 DataTable tables only. Warehouses + customer contacts are Phase 3.

### All-records export + filters
- "All records" export MUST respect active table filters — export only rows matching the
  current filter state, not the entire dataset. The page-loop must pass the active filter
  params on each page request. (This diverges from the shipped Organizations behavior, which
  ignores filters; do NOT copy that part blindly.)

### FK id columns
- FK ids shown truncated in the UI (e.g. Users `roleId`, Transactions `inventoryId`) MUST be
  exported as their human-readable name/label, not the raw or truncated id. If the row object
  already carries the related name, use it; otherwise resolve via the same lookup the table
  uses to render. If a clean name is genuinely unavailable, fall back to the full (untruncated)
  id and flag it in the plan — never export the truncated display value.

### Date formatting
- UI models differ: Location/Customer expose dates as `Date`; User/Receipt/Item/Role/Inventory
  expose ISO `string`. Export callbacks must branch by type (e.g. `Date` →
  `.toISOString().slice(0,10)`; ISO string → `new Date(x).toLocaleDateString()` or equivalent).
  Verify each table's actual model type before writing the callback.

### Cleanup
- Customers has a dead toolbar Export button (same situation as the Organizations cleanup) —
  remove it as part of the Customers task.

### Testing
- No automated tests for this work (project has no test config). The verification gate is
  `npm run build` passing plus manual export verification per table.

### Claude's Discretion
- Per-table `exportFileBaseName` naming (use a clear, kebab/snake name per table).
- Exact column ordering in exports (follow the table's visible-column order).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Export design + reference
- `.planning/phases/02-export-rollout-to-remaining-tables-wire-csv-excel-export-ont/02-RESEARCH.md` — per-table classification, component paths, column/value notes, page-loop details
- `docs/superpowers/specs/2026-06-24-table-export-design.md` — export feature design contract
- `borderworxWMSFrontend/src/shared/lib/export/` — export utilities (toCsv, toXlsx, downloadBlob, fileName)
- `OrganizationTable.tsx` — reference wiring (exportValue callbacks, handleExportAll page-loop, DataTable props)
- The shared `DataTable` component + its `ColumnDef` type (export metadata fields)
</canonical_refs>

<specifics>
## Specific Ideas

- One plan/task per table (8 tasks), each fully parallelizable — no shared file is touched.
- Plus one final task: `npm run build` + manual export smoke-check across all 8 tables.
</specifics>

<deferred>
## Deferred Ideas

- Phase 3: migrate warehouses + customer contacts to DataTable, then export them.
</deferred>

---

*Phase: 02-export-rollout-to-remaining-tables*
*Context gathered: 2026-06-25 during /gsd-plan-phase 2 (post-research)*
