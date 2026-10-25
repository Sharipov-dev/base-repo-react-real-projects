# UOM Management Feature Design

**Date:** 2026-06-04
**Status:** Approved

## Overview

Add a global Unit of Measure (UOM) library to BorderworxWMS. Replaces the free-text `Item.unitOfMeasure` string with a proper FK to a managed UOM record. Introduces a 3-tab UOM management page accessible from the Items section.

## Goals

- Centrally manage UOM definitions, conversion rules, and equivalency groups
- Link SKUs to a specific UOM record via FK (referential integrity)
- Seed standard UOMs so existing items auto-link on migration
- Expose UOM management via a dedicated page under the Items section

## Out of Scope

- Hierarchy View tab (deferred, logic TBD)
- `Item.secondaryUom` FK migration (deferred)
- UOM-aware inventory calculations (future)

---

## Data Model

### New: `UnitOfMeasure`

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| code | String (unique) | e.g. "EA", "BOX", "LB" |
| name | String | e.g. "Each", "Box", "Pound" |
| description | String? | |
| type | Enum | count \| weight \| volume \| length \| area |
| category | String? | e.g. "solids", "liquids", "dimensional" |
| symbol | String? | e.g. "kg", "lb", "ft" |
| conversionFactor | Float | Relative to base unit of same type (base = 1.0) |
| precision | Int | Decimal places for display/rounding |
| roundingRule | Enum | nearest \| up \| down |
| isBaseUnit | Boolean | True if this is the reference unit for its type |
| isActive | Boolean | Default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### New: `UomConversion`

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| fromUomId | String | FK → UnitOfMeasure |
| toUomId | String | FK → UnitOfMeasure |
| conversionFactor | Float | e.g. 20 means 1 BOX = 20 EA |
| hierarchyLevel | Int | Packaging level (0 = base, 1 = first pack, etc.) |
| isActive | Boolean | Default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### New: `EquivalencyGroup`

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| name | String | e.g. "Weight - Imperial/Metric" |
| description | String? | |
| groupType | Enum | weight \| volume \| count \| length \| area |
| isActive | Boolean | Default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### New: `EquivalencyGroupMember` (join table)

| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| groupId | String | FK → EquivalencyGroup |
| uomId | String | FK → UnitOfMeasure |
| isPrimary | Boolean | Marks the canonical UOM for the group |

### Modified: `Item`

- **Remove:** `unitOfMeasure String @default("EACH")`
- **Add:** `unitOfMeasureId String? @map("unit_of_measure_id")` — nullable FK → UnitOfMeasure

---

## Backend

### New API stacks

**UnitOfMeasure** — `/api/unit-of-measure`
- `GET /` — list (filters: type, category, isActive)
- `POST /` — create
- `PATCH /:id` — update
- `DELETE /:id` — delete (guard: reject if any Item references this UOM)

**UomConversion** — `/api/uom-conversion`
- `GET /` — list (filter: fromUomId)
- `POST /` — create
- `PATCH /:id` — update
- `DELETE /:id` — delete

**EquivalencyGroup** — `/api/equivalency-group`
- `GET /` — list
- `POST /` — create
- `PATCH /:id` — update
- `DELETE /:id` — delete
- `POST /:id/members` — add a UOM to the group
- `DELETE /:id/members/:uomId` — remove a UOM from the group

### Modified: Item use cases

- `CreateItemUseCase` + `UpdateItemUseCase` accept `unitOfMeasureId?: string`
- Validate the referenced UOM exists and is active before saving
- Item response includes `unitOfMeasure: { id, code, name }` for display

### Seed data

Pre-populate 15 standard UOMs:

| Code | Name | Type | Base? |
|---|---|---|---|
| EA | Each | count | yes |
| BOX | Box | count | no |
| CASE | Case | count | no |
| PAL | Pallet | count | no |
| LB | Pound | weight | yes |
| KG | Kilogram | weight | no |
| G | Gram | weight | no |
| OZ | Ounce | weight | no |
| FT | Foot | length | yes |
| IN | Inch | length | no |
| M | Meter | length | no |
| CM | Centimeter | length | no |
| GAL | Gallon | volume | yes |
| L | Liter | volume | no |
| SQF | Square Foot | area | yes |

Migration: for each existing item, if `unitOfMeasure` string matches a seed code (case-insensitive), set `unitOfMeasureId` to that seed record's id.

---

## Frontend

### New module: `src/modules/uom/`

```
api/unit-of-measure.api.ts
api/uom-conversion.api.ts
api/equivalency-group.api.ts
model/types.ts
model/schema.ts
lib/mapUom.ts
ui/UnitsOfMeasureTab.tsx       — list table + create/edit/delete modals
ui/ConversionsTab.tsx           — list table + create/edit modal
ui/EquivalencyGroupsTab.tsx     — list table + create/edit/delete + member management
index.ts
```

### New page: `src/app/(protected)/items/uom/page.tsx`

Renders the 3-tab UOM management container. Tabs: "Units of Measure" | "Conversions" | "Equivalency Groups".

### Tab bar

`ItemsTabBar` component shared between `/items/page.tsx` and `/items/uom/page.tsx`. Highlights active tab. No new layout file.

### New shared selector: `src/shared/ui/selectors/UomSelect.tsx`

Dropdown that fetches active UOMs and displays `code — name`. Accepts `value: string (id)` and `onChange`.

### Modified: `CreateItemForm`

- Replace free-text `unitOfMeasure` input with `UomSelect`
- Sends `unitOfMeasureId` to backend

### Routes

- `ROUTES.ITEMS_UOM = '/items/uom'` added to `routes.ts`
- No new sidebar entry — accessed via tab bar only

---

## Error Handling

- Delete UOM blocked if referenced by any Item → `ConflictError` (409)
- Create/update item with non-existent `unitOfMeasureId` → `NotFoundError` (404)
- Duplicate UOM code on create → `ConflictError` (409)
- Duplicate conversion (same fromUomId + toUomId) → `ConflictError` (409)
