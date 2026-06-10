# Bulk Location Creation + Warehouse Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bulk location creator (range-grid → preview → confirm) and a visual rack-elevation warehouse map (occupancy by inventory presence) under the Warehouse sidebar group.

**Architecture:** Backend (`borderworxWMS`, clean/DDD) gains a `POST /api/locations/bulk` endpoint (dry-run + commit) plus two read endpoints (`/structure`, `/occupancy`) on the existing location resource, a Prisma unique constraint on the location address, and new repository/use-case/DTO members following existing patterns. Frontend (`borderworxWMSFrontend`, Next.js feature modules) extends the `location` module with range-expansion/barcode libs, three new API calls, two pages (`/locations/bulk`, `/locations/map`), and two sidebar links.

**Tech Stack:** TypeScript, Express, Prisma 5, Zod, Vitest (backend); Next.js App Router, React, TanStack Query, Zod, Tailwind, Vitest (frontend).

**Paths are relative to the repo root** `/Users/sharipov/roadTrackApp/borderworx`. Backend = `borderworxWMS/`, Frontend = `borderworxWMSFrontend/`.

**Run commands from the relevant package dir.** Backend tests: `cd borderworxWMS && npx vitest run <path>`. Frontend tests: `cd borderworxWMSFrontend && npx vitest run <path>`.

---

## File Structure

### Backend (`borderworxWMS/`)
- `prisma/schema.prisma` — add `@@unique` on Location address (modify).
- `prisma/migrations/20260610000000_add_location_address_unique/migration.sql` — create.
- `src/domain/entities/location.entity.ts` — add `LocationOccupancy`, `OccupantItem`, `WarehouseStructure` types (modify).
- `src/domain/errors/location.errors.ts` — add `BulkLocationBatchTooLargeError` (modify).
- `src/domain/repositories/location.repository.ts` — add 4 method signatures (modify).
- `src/infrastructure/repositories/prisma-location.repository.ts` — implement them (modify).
- `src/application/dto/location.dto.ts` — add bulk/structure/occupancy schemas + response types (modify).
- `src/application/use-cases/location/bulk-create-locations.use-case.ts` — create.
- `src/application/use-cases/location/get-warehouse-structure.use-case.ts` — create.
- `src/application/use-cases/location/get-aisle-occupancy.use-case.ts` — create.
- `src/interfaces/http/controllers/location.controller.ts` — add 3 handlers (modify).
- `src/interfaces/http/routes/location.routes.ts` — add 3 routes, correct ordering (modify).
- `src/main/container.ts` — wire 3 new use-cases into `LocationController` (modify).
- `tests/unit/use-cases/bulk-create-locations.use-case.test.ts` — create.
- `tests/unit/use-cases/get-warehouse-structure.use-case.test.ts` — create.

### Frontend (`borderworxWMSFrontend/`)
- `src/shared/config/routes.ts` — add 2 routes + `PROTECTED_PATHS` entries (modify).
- `src/widgets/Sidebar/Sidebar.tsx` — add 2 Warehouse children (modify).
- `src/modules/location/lib/expandRanges.ts` — create.
- `src/modules/location/lib/buildBarcode.ts` — create.
- `src/modules/location/model/types.ts` — add bulk/structure/occupancy types (modify).
- `src/modules/location/model/schema.ts` — add response schemas (modify).
- `src/modules/location/api/location.api.ts` — add 3 functions (modify).
- `src/modules/location/ui/BulkCreateLocationsForm.tsx` — create.
- `src/modules/location/ui/WarehouseMap.tsx` — create.
- `src/modules/location/index.ts` — export new UI + fns (modify).
- `src/app/(protected)/locations/bulk/page.tsx` — create.
- `src/app/(protected)/locations/map/page.tsx` — create.
- `src/modules/location/lib/__tests__/expandRanges.test.ts` — create.
- `src/modules/location/lib/__tests__/buildBarcode.test.ts` — create.
- `src/modules/location/__tests__/location-bulk-map.api.test.ts` — create.

---

# PHASE A — Backend

## Task A1: Address-uniqueness migration

**Files:**
- Modify: `borderworxWMS/prisma/schema.prisma` (Location model, around line 142)
- Create: `borderworxWMS/prisma/migrations/20260610000000_add_location_address_unique/migration.sql`

- [ ] **Step 1: Pre-check for existing duplicate addresses**

This constraint will fail to apply if duplicates already exist. Check first.

Run:
```bash
cd borderworxWMS && npx prisma db execute --stdin <<'SQL'
SELECT warehouse_id, zone, aisle, bay, level, position, COUNT(*)
FROM locations
GROUP BY warehouse_id, zone, aisle, bay, level, position
HAVING COUNT(*) > 1;
SQL
```
Expected: zero rows. **If any rows return, STOP** and report to the user — duplicates must be resolved (renamed or removed) before the constraint can be added. Do not proceed with this task until clean.

- [ ] **Step 2: Add the unique constraint to the schema**

In `prisma/schema.prisma`, inside `model Location`, immediately before the existing `@@map("locations")` line, add:

```prisma
  @@unique([warehouseId, zone, aisle, bay, level, position], name: "location_address_unique")
```

- [ ] **Step 3: Create the migration SQL**

Create `prisma/migrations/20260610000000_add_location_address_unique/migration.sql`:

```sql
-- Prevent duplicate physical addresses within a warehouse
CREATE UNIQUE INDEX "location_address_unique"
ON "locations" ("warehouse_id", "zone", "aisle", "bay", "level", "position");
```

- [ ] **Step 4: Apply migration and regenerate client**

Run:
```bash
cd borderworxWMS && npx prisma migrate deploy && npx prisma generate
```
Expected: migration `20260610000000_add_location_address_unique` applied, client regenerated, no errors.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMS && git add prisma/schema.prisma prisma/migrations/20260610000000_add_location_address_unique
git commit -m "feat(db): add unique constraint on location address"
```

---

## Task A2: Domain types + repository signatures

**Files:**
- Modify: `borderworxWMS/src/domain/entities/location.entity.ts`
- Modify: `borderworxWMS/src/domain/repositories/location.repository.ts`
- Modify: `borderworxWMS/src/domain/errors/location.errors.ts`

- [ ] **Step 1: Add domain types**

Append to `src/domain/entities/location.entity.ts`:

```typescript
export interface OccupantItem {
  itemSku: string;
  itemName: string;
  quantity: number;
  lotNumber: string | null;
}

export interface LocationOccupancy {
  location: Location;
  occupied: boolean;
  inventory: OccupantItem[];
}

export interface WarehouseStructure {
  zones: Array<{ zone: string; aisles: string[] }>;
}
```

- [ ] **Step 2: Add a batch-size error**

First, confirm the 400-level error class name: `grep -n "class.*Error" src/shared/errors/app-error.ts`. Expected: a `ValidationError` (or similarly-named 400 class). Then **merge** `ValidationError` into the existing import at the top of `src/domain/errors/location.errors.ts` (do not add a second import line from the same module):

```typescript
import { ConflictError, NotFoundError, ValidationError } from '../../shared/errors/app-error.js';
```

And append the new error class to the file:

```typescript
export class BulkLocationBatchTooLargeError extends ValidationError {
  constructor(max: number, actual: number) {
    super(`Bulk location batch too large: ${actual} exceeds the maximum of ${max}`);
  }
}
```

If the 400-level class has a different name, substitute it in both the import and the `extends` clause.

- [ ] **Step 3: Add repository method signatures**

In `src/domain/repositories/location.repository.ts`, add these to the `LocationRepository` interface (after `existsByBarcode`):

```typescript
  /** Existing address keys (`zone|aisle|bay|level|position`) for a warehouse. */
  findAddressKeysByWarehouse(warehouseId: string): Promise<string[]>;
  /** Subset of the given barcodes that already exist. */
  findExistingBarcodes(barcodes: string[]): Promise<string[]>;
  /** Bulk insert; returns the number of rows created. */
  createMany(data: CreateLocationData[]): Promise<number>;
  /** Distinct (zone, aisle) pairs for a warehouse, ordered. */
  findDistinctStructure(warehouseId: string): Promise<Array<{ zone: string; aisle: string }>>;
  /** All locations in an aisle with their (qty>0) inventory + item summary. */
  findAisleOccupancy(warehouseId: string, zone: string, aisle: string): Promise<LocationOccupancy[]>;
```

Add `LocationOccupancy` to the existing import from `../entities/location.entity.js` at the top of the file.

- [ ] **Step 4: Typecheck**

Run: `cd borderworxWMS && npx tsc --noEmit`
Expected: errors ONLY in `prisma-location.repository.ts` (missing implementations) — that is the next task. No errors in the three files edited here.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMS && git add src/domain/entities/location.entity.ts src/domain/repositories/location.repository.ts src/domain/errors/location.errors.ts
git commit -m "feat(location): add domain types + repo signatures for bulk/map"
```

---

## Task A3: Repository implementation

**Files:**
- Modify: `borderworxWMS/src/infrastructure/repositories/prisma-location.repository.ts`

- [ ] **Step 1: Add imports**

At the top of `prisma-location.repository.ts`, extend the entity import to include `LocationOccupancy`:

```typescript
import type { CreateLocationData, Location, LocationOccupancy, UpdateLocationData } from '../../domain/entities/location.entity.js';
```

- [ ] **Step 2: Implement the new methods**

Add these methods inside the `PrismaLocationRepository` class (before the closing brace):

```typescript
  async findAddressKeysByWarehouse(warehouseId: string): Promise<string[]> {
    const rows = await this.prisma.location.findMany({
      where: { warehouseId },
      select: { zone: true, aisle: true, bay: true, level: true, position: true },
    });
    return rows.map((r) => `${r.zone}|${r.aisle}|${r.bay}|${r.level}|${r.position}`);
  }

  async findExistingBarcodes(barcodes: string[]): Promise<string[]> {
    if (barcodes.length === 0) return [];
    const rows = await this.prisma.location.findMany({
      where: { barcode: { in: barcodes } },
      select: { barcode: true },
    });
    return rows.map((r) => r.barcode).filter((b): b is string => b !== null);
  }

  async createMany(data: CreateLocationData[]): Promise<number> {
    const result = await this.prisma.location.createMany({
      data: data.map((d) => ({
        zone: d.zone,
        aisle: d.aisle,
        bay: d.bay,
        level: d.level,
        position: d.position,
        ...(d.locationType !== undefined && { locationType: d.locationType }),
        capacity: d.capacity ?? null,
        maxWeight: d.maxWeight ?? null,
        maxVolume: d.maxVolume ?? null,
        dimensions: d.dimensions ?? null,
        barcode: d.barcode ?? null,
        ...(d.isActive !== undefined && { isActive: d.isActive }),
        ...(d.nonPickable !== undefined && { nonPickable: d.nonPickable }),
        warehouseId: d.warehouseId,
      })),
      skipDuplicates: true,
    });
    return result.count;
  }

  async findDistinctStructure(warehouseId: string): Promise<Array<{ zone: string; aisle: string }>> {
    return this.prisma.location.findMany({
      where: { warehouseId },
      distinct: ['zone', 'aisle'],
      select: { zone: true, aisle: true },
      orderBy: [{ zone: 'asc' }, { aisle: 'asc' }],
    });
  }

  async findAisleOccupancy(warehouseId: string, zone: string, aisle: string): Promise<LocationOccupancy[]> {
    const rows = await this.prisma.location.findMany({
      where: { warehouseId, zone, aisle },
      orderBy: [{ level: 'asc' }, { bay: 'asc' }, { position: 'asc' }],
      include: {
        inventory: {
          where: { quantity: { gt: 0 } },
          include: { item: { select: { sku: true, name: true } } },
        },
      },
    });

    return rows.map((row) => {
      const { inventory, ...locationFields } = row;
      return {
        location: LocationMapper.toDomain(locationFields),
        occupied: inventory.length > 0,
        inventory: inventory.map((inv) => ({
          itemSku: inv.item.sku,
          itemName: inv.item.name,
          quantity: inv.quantity,
          lotNumber: inv.lotNumber,
        })),
      };
    });
  }
```

- [ ] **Step 3: Typecheck**

Run: `cd borderworxWMS && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
cd borderworxWMS && git add src/infrastructure/repositories/prisma-location.repository.ts
git commit -m "feat(location): implement bulk/structure/occupancy repository methods"
```

---

## Task A4: Bulk-create use-case (TDD)

**Files:**
- Create: `borderworxWMS/src/application/use-cases/location/bulk-create-locations.use-case.ts`
- Test: `borderworxWMS/tests/unit/use-cases/bulk-create-locations.use-case.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/use-cases/bulk-create-locations.use-case.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BulkCreateLocationsUseCase } from '../../../src/application/use-cases/location/bulk-create-locations.use-case.js';
import { BulkLocationBatchTooLargeError } from '../../../src/domain/errors/location.errors.js';
import type { LocationRepository } from '../../../src/domain/repositories/location.repository.js';
import type { CreateLocationData } from '../../../src/domain/entities/location.entity.js';

const WH = '11111111-1111-1111-1111-111111111111';

function loc(overrides: Partial<CreateLocationData>): CreateLocationData {
  return {
    zone: 'A', aisle: '01', bay: '01', level: '1', position: '1',
    warehouseId: WH, barcode: null, ...overrides,
  };
}

describe('BulkCreateLocationsUseCase', () => {
  let useCase: BulkCreateLocationsUseCase;
  let mockRepo: LocationRepository;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(), findAll: vi.fn(), count: vi.fn(), create: vi.fn(),
      update: vi.fn(), delete: vi.fn(), existsById: vi.fn(),
      findByBarcode: vi.fn(), existsByBarcode: vi.fn(),
      findAddressKeysByWarehouse: vi.fn().mockResolvedValue([]),
      findExistingBarcodes: vi.fn().mockResolvedValue([]),
      createMany: vi.fn().mockResolvedValue(0),
      findDistinctStructure: vi.fn(), findAisleOccupancy: vi.fn(),
    } as unknown as LocationRepository;
    useCase = new BulkCreateLocationsUseCase(mockRepo);
  });

  it('creates all locations when none conflict', async () => {
    vi.mocked(mockRepo.createMany).mockResolvedValue(2);
    const result = await useCase.execute({
      locations: [loc({ position: '1', barcode: 'B1' }), loc({ position: '2', barcode: 'B2' })],
    });
    expect(result.dryRun).toBe(false);
    expect(result.created).toBe(2);
    expect(result.skipped).toHaveLength(0);
    expect(mockRepo.createMany).toHaveBeenCalledOnce();
  });

  it('skips addresses that already exist in the database', async () => {
    vi.mocked(mockRepo.findAddressKeysByWarehouse).mockResolvedValue(['A|01|01|1|1']);
    vi.mocked(mockRepo.createMany).mockResolvedValue(1);
    const result = await useCase.execute({
      locations: [loc({ position: '1', barcode: 'B1' }), loc({ position: '2', barcode: 'B2' })],
    });
    expect(result.skipped).toEqual([{ address: 'A-01-01-1-1', reason: 'address_exists' }]);
    expect(mockRepo.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ position: '2' }),
    ]);
  });

  it('skips duplicate addresses within the batch', async () => {
    const result = await useCase.execute({
      locations: [loc({ position: '1', barcode: 'B1' }), loc({ position: '1', barcode: 'B2' })],
    });
    expect(result.skipped).toEqual([{ address: 'A-01-01-1-1', reason: 'duplicate_in_batch' }]);
  });

  it('skips barcodes that already exist', async () => {
    vi.mocked(mockRepo.findExistingBarcodes).mockResolvedValue(['B1']);
    const result = await useCase.execute({
      locations: [loc({ position: '1', barcode: 'B1' })],
    });
    expect(result.skipped).toEqual([{ address: 'A-01-01-1-1', reason: 'barcode_exists' }]);
    expect(mockRepo.createMany).not.toHaveBeenCalled();
  });

  it('does not write in dry-run mode but reports counts', async () => {
    const result = await useCase.execute({
      locations: [loc({ position: '1', barcode: 'B1' })],
      dryRun: true,
    });
    expect(result.dryRun).toBe(true);
    expect(result.created).toBe(1); // "would create"
    expect(mockRepo.createMany).not.toHaveBeenCalled();
  });

  it('throws when the batch exceeds the cap', async () => {
    const many = Array.from({ length: 2001 }, (_, i) => loc({ position: String(i) }));
    await expect(useCase.execute({ locations: many })).rejects.toThrow(BulkLocationBatchTooLargeError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd borderworxWMS && npx vitest run tests/unit/use-cases/bulk-create-locations.use-case.test.ts`
Expected: FAIL — cannot find module `bulk-create-locations.use-case.js`.

- [ ] **Step 3: Implement the use-case**

Create `src/application/use-cases/location/bulk-create-locations.use-case.ts`:

```typescript
import type { CreateLocationData } from '../../../domain/entities/location.entity.js';
import { BulkLocationBatchTooLargeError } from '../../../domain/errors/location.errors.js';
import type { LocationRepository } from '../../../domain/repositories/location.repository.js';

const MAX_BATCH = 2000;

export type SkipReason = 'duplicate_in_batch' | 'address_exists' | 'barcode_exists';

export interface SkippedEntry {
  address: string;
  reason: SkipReason;
}

export interface BulkCreateInput {
  locations: CreateLocationData[];
  dryRun?: boolean;
}

export interface BulkCreateResult {
  dryRun: boolean;
  created: number; // rows created, or "would create" when dryRun
  skipped: SkippedEntry[];
}

function addressKey(l: CreateLocationData): string {
  return `${l.zone}|${l.aisle}|${l.bay}|${l.level}|${l.position}`;
}

function addressLabel(l: CreateLocationData): string {
  return `${l.zone}-${l.aisle}-${l.bay}-${l.level}-${l.position}`;
}

export class BulkCreateLocationsUseCase {
  constructor(private readonly locationRepository: LocationRepository) {}

  async execute(input: BulkCreateInput): Promise<BulkCreateResult> {
    const { locations, dryRun = false } = input;

    if (locations.length > MAX_BATCH) {
      throw new BulkLocationBatchTooLargeError(MAX_BATCH, locations.length);
    }

    const warehouseIds = [...new Set(locations.map((l) => l.warehouseId))];
    const existingAddresses = new Set<string>();
    for (const wid of warehouseIds) {
      const keys = await this.locationRepository.findAddressKeysByWarehouse(wid);
      for (const k of keys) existingAddresses.add(`${wid}::${k}`);
    }

    const candidateBarcodes = locations
      .map((l) => l.barcode)
      .filter((b): b is string => !!b);
    const existingBarcodes = new Set(
      await this.locationRepository.findExistingBarcodes(candidateBarcodes),
    );

    const seenAddresses = new Set<string>();
    const seenBarcodes = new Set<string>();
    const skipped: SkippedEntry[] = [];
    const toCreate: CreateLocationData[] = [];

    for (const l of locations) {
      const fullKey = `${l.warehouseId}::${addressKey(l)}`;
      if (seenAddresses.has(fullKey)) {
        skipped.push({ address: addressLabel(l), reason: 'duplicate_in_batch' });
        continue;
      }
      seenAddresses.add(fullKey);

      if (existingAddresses.has(fullKey)) {
        skipped.push({ address: addressLabel(l), reason: 'address_exists' });
        continue;
      }
      if (l.barcode && (existingBarcodes.has(l.barcode) || seenBarcodes.has(l.barcode))) {
        skipped.push({ address: addressLabel(l), reason: 'barcode_exists' });
        continue;
      }
      if (l.barcode) seenBarcodes.add(l.barcode);
      toCreate.push(l);
    }

    if (dryRun) {
      return { dryRun: true, created: toCreate.length, skipped };
    }

    const created = toCreate.length > 0 ? await this.locationRepository.createMany(toCreate) : 0;
    return { dryRun: false, created, skipped };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd borderworxWMS && npx vitest run tests/unit/use-cases/bulk-create-locations.use-case.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
cd borderworxWMS && git add src/application/use-cases/location/bulk-create-locations.use-case.ts tests/unit/use-cases/bulk-create-locations.use-case.test.ts
git commit -m "feat(location): add bulk-create use-case with dry-run + dedup"
```

---

## Task A5: Structure + occupancy use-cases (TDD on structure)

**Files:**
- Create: `borderworxWMS/src/application/use-cases/location/get-warehouse-structure.use-case.ts`
- Create: `borderworxWMS/src/application/use-cases/location/get-aisle-occupancy.use-case.ts`
- Test: `borderworxWMS/tests/unit/use-cases/get-warehouse-structure.use-case.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/use-cases/get-warehouse-structure.use-case.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetWarehouseStructureUseCase } from '../../../src/application/use-cases/location/get-warehouse-structure.use-case.js';
import type { LocationRepository } from '../../../src/domain/repositories/location.repository.js';

describe('GetWarehouseStructureUseCase', () => {
  let useCase: GetWarehouseStructureUseCase;
  let mockRepo: LocationRepository;

  beforeEach(() => {
    mockRepo = {
      findDistinctStructure: vi.fn(),
    } as unknown as LocationRepository;
    useCase = new GetWarehouseStructureUseCase(mockRepo);
  });

  it('groups distinct (zone, aisle) pairs into zones with aisle lists', async () => {
    vi.mocked(mockRepo.findDistinctStructure).mockResolvedValue([
      { zone: 'A', aisle: '01' },
      { zone: 'A', aisle: '02' },
      { zone: 'B', aisle: '01' },
    ]);

    const result = await useCase.execute('wh-1');

    expect(result).toEqual({
      zones: [
        { zone: 'A', aisles: ['01', '02'] },
        { zone: 'B', aisles: ['01'] },
      ],
    });
  });

  it('returns empty zones for a warehouse with no locations', async () => {
    vi.mocked(mockRepo.findDistinctStructure).mockResolvedValue([]);
    const result = await useCase.execute('wh-1');
    expect(result).toEqual({ zones: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd borderworxWMS && npx vitest run tests/unit/use-cases/get-warehouse-structure.use-case.test.ts`
Expected: FAIL — cannot find module.

- [ ] **Step 3: Implement both use-cases**

Create `src/application/use-cases/location/get-warehouse-structure.use-case.ts`:

```typescript
import type { WarehouseStructure } from '../../../domain/entities/location.entity.js';
import type { LocationRepository } from '../../../domain/repositories/location.repository.js';

export class GetWarehouseStructureUseCase {
  constructor(private readonly locationRepository: LocationRepository) {}

  async execute(warehouseId: string): Promise<WarehouseStructure> {
    const pairs = await this.locationRepository.findDistinctStructure(warehouseId);
    const byZone = new Map<string, string[]>();
    for (const { zone, aisle } of pairs) {
      const aisles = byZone.get(zone) ?? [];
      aisles.push(aisle);
      byZone.set(zone, aisles);
    }
    return {
      zones: [...byZone.entries()].map(([zone, aisles]) => ({ zone, aisles })),
    };
  }
}
```

Create `src/application/use-cases/location/get-aisle-occupancy.use-case.ts`:

```typescript
import type { LocationOccupancy } from '../../../domain/entities/location.entity.js';
import type { LocationRepository } from '../../../domain/repositories/location.repository.js';

export class GetAisleOccupancyUseCase {
  constructor(private readonly locationRepository: LocationRepository) {}

  execute(warehouseId: string, zone: string, aisle: string): Promise<LocationOccupancy[]> {
    return this.locationRepository.findAisleOccupancy(warehouseId, zone, aisle);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd borderworxWMS && npx vitest run tests/unit/use-cases/get-warehouse-structure.use-case.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd borderworxWMS && git add src/application/use-cases/location/get-warehouse-structure.use-case.ts src/application/use-cases/location/get-aisle-occupancy.use-case.ts tests/unit/use-cases/get-warehouse-structure.use-case.test.ts
git commit -m "feat(location): add structure + occupancy use-cases"
```

---

## Task A6: DTO schemas + response types

**Files:**
- Modify: `borderworxWMS/src/application/dto/location.dto.ts`

- [ ] **Step 1: Add schemas and response types**

Append to `src/application/dto/location.dto.ts` (the `createLocationSchema` already exists above):

```typescript
export const bulkCreateLocationsSchema = z.object({
  locations: z.array(createLocationSchema).min(1, 'At least one location is required').max(2000, 'Maximum 2000 locations per batch'),
  dryRun: z.boolean().optional(),
});

export const warehouseStructureQuerySchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
});

export const aisleOccupancyQuerySchema = z.object({
  warehouseId: z.string().uuid('Invalid warehouse ID'),
  zone: z.string().min(1, 'Zone is required'),
  aisle: z.string().min(1, 'Aisle is required'),
});

export type BulkCreateLocationsDto = z.infer<typeof bulkCreateLocationsSchema>;
export type WarehouseStructureQuery = z.infer<typeof warehouseStructureQuerySchema>;
export type AisleOccupancyQuery = z.infer<typeof aisleOccupancyQuerySchema>;

export interface BulkCreateLocationsResponseDto {
  dryRun: boolean;
  created: number;
  skipped: Array<{ address: string; reason: string }>;
}

export interface WarehouseStructureResponseDto {
  zones: Array<{ zone: string; aisles: string[] }>;
}

export interface LocationOccupancyResponseDto {
  location: LocationResponseDto;
  occupied: boolean;
  inventory: Array<{ itemSku: string; itemName: string; quantity: number; lotNumber: string | null }>;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd borderworxWMS && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd borderworxWMS && git add src/application/dto/location.dto.ts
git commit -m "feat(location): add bulk/structure/occupancy DTOs"
```

---

## Task A7: Controller handlers

**Files:**
- Modify: `borderworxWMS/src/interfaces/http/controllers/location.controller.ts`

- [ ] **Step 1: Extend imports**

In `location.controller.ts`, extend the DTO import to add the new types, and add the three use-case type imports:

```typescript
import type {
  AisleOccupancyQuery,
  BulkCreateLocationsDto,
  BulkCreateLocationsResponseDto,
  CreateLocationDto,
  ListLocationsQuery,
  LocationOccupancyResponseDto,
  LocationResponseDto,
  UpdateLocationDto,
  WarehouseStructureQuery,
  WarehouseStructureResponseDto,
} from '../../../application/dto/location.dto.js';
import type { BulkCreateLocationsUseCase } from '../../../application/use-cases/location/bulk-create-locations.use-case.js';
import type { GetAisleOccupancyUseCase } from '../../../application/use-cases/location/get-aisle-occupancy.use-case.js';
import type { GetWarehouseStructureUseCase } from '../../../application/use-cases/location/get-warehouse-structure.use-case.js';
import type { LocationOccupancy } from '../../../domain/entities/location.entity.js';
```

- [ ] **Step 2: Add a mapper for occupancy**

Below the existing `toLocationResponse` function, add:

```typescript
function toOccupancyResponse(o: LocationOccupancy): LocationOccupancyResponseDto {
  return {
    location: toLocationResponse(o.location),
    occupied: o.occupied,
    inventory: o.inventory.map((i) => ({
      itemSku: i.itemSku,
      itemName: i.itemName,
      quantity: i.quantity,
      lotNumber: i.lotNumber,
    })),
  };
}
```

- [ ] **Step 3: Extend the constructor**

Replace the existing constructor parameter list with (adds 3 params after `deleteLocationUseCase`):

```typescript
  constructor(
    private readonly createLocationUseCase: CreateLocationUseCase,
    private readonly getLocationByIdUseCase: GetLocationByIdUseCase,
    private readonly listLocationsUseCase: ListLocationsUseCase,
    private readonly updateLocationUseCase: UpdateLocationUseCase,
    private readonly deleteLocationUseCase: DeleteLocationUseCase,
    private readonly bulkCreateLocationsUseCase: BulkCreateLocationsUseCase,
    private readonly getWarehouseStructureUseCase: GetWarehouseStructureUseCase,
    private readonly getAisleOccupancyUseCase: GetAisleOccupancyUseCase,
  ) {}
```

- [ ] **Step 4: Add the three handlers**

Add these methods inside the class (after `delete`):

```typescript
  async bulkCreate(req: Request, res: Response): Promise<void> {
    const body = req.body as BulkCreateLocationsDto;
    const result = await this.bulkCreateLocationsUseCase.execute(body);
    const response: BulkCreateLocationsResponseDto = result;
    sendSuccess(res, response, result.dryRun ? 200 : 201);
  }

  async getStructure(req: Request, res: Response): Promise<void> {
    const { warehouseId } = req.query as unknown as WarehouseStructureQuery;
    const structure = await this.getWarehouseStructureUseCase.execute(warehouseId);
    const response: WarehouseStructureResponseDto = structure;
    sendSuccess(res, response);
  }

  async getOccupancy(req: Request, res: Response): Promise<void> {
    const { warehouseId, zone, aisle } = req.query as unknown as AisleOccupancyQuery;
    const occupancy = await this.getAisleOccupancyUseCase.execute(warehouseId, zone, aisle);
    sendSuccess(res, occupancy.map(toOccupancyResponse));
  }
```

- [ ] **Step 5: Typecheck**

Run: `cd borderworxWMS && npx tsc --noEmit`
Expected: errors only in `container.ts` (constructor arity) — fixed in Task A9. No errors in `location.controller.ts`.

- [ ] **Step 6: Commit**

```bash
cd borderworxWMS && git add src/interfaces/http/controllers/location.controller.ts
git commit -m "feat(location): add bulk/structure/occupancy controller handlers"
```

---

## Task A8: Routes (correct ordering)

**Files:**
- Modify: `borderworxWMS/src/interfaces/http/routes/location.routes.ts`

- [ ] **Step 1: Extend imports**

Extend the DTO import in `location.routes.ts`:

```typescript
import {
  aisleOccupancyQuerySchema,
  bulkCreateLocationsSchema,
  createLocationSchema,
  listLocationsQuerySchema,
  locationIdParamSchema,
  updateLocationSchema,
  warehouseStructureQuerySchema,
} from '../../../application/dto/location.dto.js';
```

- [ ] **Step 2: Register new routes BEFORE the `/:id` routes**

In `createLocationRoutes`, add these three blocks **immediately after the `POST /` block and the `GET /` block, but before the `GET /:id` block** (ordering matters — `/structure` and `/occupancy` must not be captured by `/:id`):

```typescript
  router.post(
    '/bulk',
    authMiddleware,
    validate({ body: bulkCreateLocationsSchema }),
    asyncHandler(async (req, res) => {
      await controller.bulkCreate(req, res);
    }),
  );

  router.get(
    '/structure',
    authMiddleware,
    validate({ query: warehouseStructureQuerySchema }),
    asyncHandler(async (req, res) => {
      await controller.getStructure(req, res);
    }),
  );

  router.get(
    '/occupancy',
    authMiddleware,
    validate({ query: aisleOccupancyQuerySchema }),
    asyncHandler(async (req, res) => {
      await controller.getOccupancy(req, res);
    }),
  );
```

- [ ] **Step 3: Verify ordering by reading the file**

Run: `cd borderworxWMS && grep -n "router\.\(get\|post\|patch\|delete\)" src/interfaces/http/routes/location.routes.ts`
Expected: `/bulk`, `/structure`, `/occupancy` all appear at lower line numbers than `/:id`.

- [ ] **Step 4: Commit**

```bash
cd borderworxWMS && git add src/interfaces/http/routes/location.routes.ts
git commit -m "feat(location): register bulk/structure/occupancy routes"
```

---

## Task A9: Wire dependencies in the container

**Files:**
- Modify: `borderworxWMS/src/main/container.ts`

- [ ] **Step 1: Add use-case imports**

Near the other location use-case imports (around line 112-116), add:

```typescript
import { BulkCreateLocationsUseCase } from '../application/use-cases/location/bulk-create-locations.use-case.js';
import { GetAisleOccupancyUseCase } from '../application/use-cases/location/get-aisle-occupancy.use-case.js';
import { GetWarehouseStructureUseCase } from '../application/use-cases/location/get-warehouse-structure.use-case.js';
```

- [ ] **Step 2: Instantiate the use-cases**

In the "Location Use Cases" section (around line 216-221), after `deleteLocationUseCase`, add:

```typescript
const bulkCreateLocationsUseCase = new BulkCreateLocationsUseCase(locationRepository);
const getWarehouseStructureUseCase = new GetWarehouseStructureUseCase(locationRepository);
const getAisleOccupancyUseCase = new GetAisleOccupancyUseCase(locationRepository);
```

- [ ] **Step 3: Pass them to the controller**

Update the `new LocationController(...)` call (around line 389) to append the three new args:

```typescript
const locationController = new LocationController(
  createLocationUseCase,
  getLocationByIdUseCase,
  listLocationsUseCase,
  updateLocationUseCase,
  deleteLocationUseCase,
  bulkCreateLocationsUseCase,
  getWarehouseStructureUseCase,
  getAisleOccupancyUseCase,
);
```

- [ ] **Step 4: Full typecheck + backend test suite**

Run: `cd borderworxWMS && npx tsc --noEmit && npx vitest run tests/unit/use-cases/bulk-create-locations.use-case.test.ts tests/unit/use-cases/get-warehouse-structure.use-case.test.ts`
Expected: typecheck PASS; 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMS && git add src/main/container.ts
git commit -m "feat(location): wire bulk/structure/occupancy use-cases into container"
```

---

# PHASE B — Frontend: Bulk Create

## Task B1: Range expansion lib (TDD)

**Files:**
- Create: `borderworxWMSFrontend/src/modules/location/lib/expandRanges.ts`
- Test: `borderworxWMSFrontend/src/modules/location/lib/__tests__/expandRanges.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/location/lib/__tests__/expandRanges.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { expandValueSet, expandDimensions } from '../expandRanges';

describe('expandValueSet', () => {
  it('expands a comma list', () => {
    expect(expandValueSet('A, B, C')).toEqual(['A', 'B', 'C']);
  });
  it('expands a numeric range', () => {
    expect(expandValueSet('1-4')).toEqual(['1', '2', '3', '4']);
  });
  it('preserves zero-padding width in ranges', () => {
    expect(expandValueSet('01-03')).toEqual(['01', '02', '03']);
  });
  it('handles a single value', () => {
    expect(expandValueSet('A')).toEqual(['A']);
  });
  it('trims and ignores empty entries in lists', () => {
    expect(expandValueSet('A, , B,')).toEqual(['A', 'B']);
  });
  it('returns empty array for empty input', () => {
    expect(expandValueSet('   ')).toEqual([]);
  });
  it('throws on a descending range', () => {
    expect(() => expandValueSet('5-1')).toThrow();
  });
});

describe('expandDimensions', () => {
  it('produces the cartesian product across all five dimensions', () => {
    const result = expandDimensions({ zone: 'A', aisle: '1-2', bay: '1', level: '1', position: '1-2' });
    expect(result).toEqual([
      { zone: 'A', aisle: '1', bay: '1', level: '1', position: '1' },
      { zone: 'A', aisle: '1', bay: '1', level: '1', position: '2' },
      { zone: 'A', aisle: '2', bay: '1', level: '1', position: '1' },
      { zone: 'A', aisle: '2', bay: '1', level: '1', position: '2' },
    ]);
  });
  it('returns empty array if any dimension is empty', () => {
    expect(expandDimensions({ zone: 'A', aisle: '', bay: '1', level: '1', position: '1' })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/location/lib/__tests__/expandRanges.test.ts`
Expected: FAIL — cannot find module `../expandRanges`.

- [ ] **Step 3: Implement the lib**

Create `src/modules/location/lib/expandRanges.ts`:

```typescript
export interface DimensionInput {
  zone: string;
  aisle: string;
  bay: string;
  level: string;
  position: string;
}

export type LocationCoords = DimensionInput;

const RANGE_RE = /^(\d+)\s*-\s*(\d+)$/;

/**
 * Expand a single dimension value-set string into discrete values.
 * Supports: comma lists ("A, B, C"), numeric ranges ("1-10"),
 * and zero-padded numeric ranges ("01-10" → 01..10).
 */
export function expandValueSet(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];

  const rangeMatch = trimmed.match(RANGE_RE);
  if (rangeMatch) {
    const [, startRaw, endRaw] = rangeMatch;
    const start = Number(startRaw);
    const end = Number(endRaw);
    if (end < start) {
      throw new Error(`Invalid range "${trimmed}": end is less than start`);
    }
    const width = Math.max(startRaw.length, endRaw.length);
    const padded = startRaw.startsWith('0') || endRaw.startsWith('0');
    const out: string[] = [];
    for (let n = start; n <= end; n++) {
      out.push(padded ? String(n).padStart(width, '0') : String(n));
    }
    return out;
  }

  return trimmed
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Cartesian product of all five dimensions. Empty if any dimension is empty. */
export function expandDimensions(input: DimensionInput): LocationCoords[] {
  const zones = expandValueSet(input.zone);
  const aisles = expandValueSet(input.aisle);
  const bays = expandValueSet(input.bay);
  const levels = expandValueSet(input.level);
  const positions = expandValueSet(input.position);

  if (![zones, aisles, bays, levels, positions].every((d) => d.length > 0)) {
    return [];
  }

  const out: LocationCoords[] = [];
  for (const zone of zones)
    for (const aisle of aisles)
      for (const bay of bays)
        for (const level of levels)
          for (const position of positions)
            out.push({ zone, aisle, bay, level, position });
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/location/lib/__tests__/expandRanges.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
cd borderworxWMSFrontend && git add src/modules/location/lib/expandRanges.ts src/modules/location/lib/__tests__/expandRanges.test.ts
git commit -m "feat(location): add range-expansion lib"
```

---

## Task B2: Barcode builder lib (TDD)

**Files:**
- Create: `borderworxWMSFrontend/src/modules/location/lib/buildBarcode.ts`
- Test: `borderworxWMSFrontend/src/modules/location/lib/__tests__/buildBarcode.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/location/lib/__tests__/buildBarcode.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildBarcode, DEFAULT_BARCODE_PATTERN } from '../buildBarcode';

const coords = { zone: 'A', aisle: '01', bay: '02', level: '3', position: '2' };

describe('buildBarcode', () => {
  it('uses the default pattern with the warehouse code', () => {
    expect(buildBarcode(DEFAULT_BARCODE_PATTERN, coords, 'WH1')).toBe('WH1-A-01-02-3-2');
  });
  it('substitutes a custom pattern', () => {
    expect(buildBarcode('{zone}{aisle}{bay}{level}{position}', coords, 'WH1')).toBe('A010232');
  });
  it('leaves unknown tokens untouched', () => {
    expect(buildBarcode('{zone}-{unknown}', coords, 'WH1')).toBe('A-{unknown}');
  });
  it('substitutes whCode token', () => {
    expect(buildBarcode('{whCode}', coords, 'WH1')).toBe('WH1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/location/lib/__tests__/buildBarcode.test.ts`
Expected: FAIL — cannot find module `../buildBarcode`.

- [ ] **Step 3: Implement the lib**

Create `src/modules/location/lib/buildBarcode.ts`:

```typescript
import type { LocationCoords } from './expandRanges';

export const DEFAULT_BARCODE_PATTERN = '{whCode}-{zone}-{aisle}-{bay}-{level}-{position}';

/**
 * Build a barcode string from a pattern. Recognized tokens:
 * {whCode} {zone} {aisle} {bay} {level} {position}. Unknown tokens are left as-is.
 */
export function buildBarcode(pattern: string, coords: LocationCoords, whCode: string): string {
  const values: Record<string, string> = {
    whCode,
    zone: coords.zone,
    aisle: coords.aisle,
    bay: coords.bay,
    level: coords.level,
    position: coords.position,
  };
  return pattern.replace(/\{(whCode|zone|aisle|bay|level|position)\}/g, (_, key: string) => values[key]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/location/lib/__tests__/buildBarcode.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
cd borderworxWMSFrontend && git add src/modules/location/lib/buildBarcode.ts src/modules/location/lib/__tests__/buildBarcode.test.ts
git commit -m "feat(location): add barcode-pattern builder"
```

---

## Task B3: Frontend types + schemas + API (TDD on API)

**Files:**
- Modify: `borderworxWMSFrontend/src/modules/location/model/types.ts`
- Modify: `borderworxWMSFrontend/src/modules/location/model/schema.ts`
- Modify: `borderworxWMSFrontend/src/modules/location/api/location.api.ts`
- Test: `borderworxWMSFrontend/src/modules/location/__tests__/location-bulk-map.api.test.ts`

- [ ] **Step 1: Add types**

Append to `src/modules/location/model/types.ts`:

```typescript
export interface BulkCreateLocationsRequest {
  locations: CreateLocationRequest[];
  dryRun?: boolean;
}

export interface BulkSkippedEntry {
  address: string;
  reason: string;
}

export interface BulkCreateResult {
  dryRun: boolean;
  created: number;
  skipped: BulkSkippedEntry[];
}

export interface WarehouseStructure {
  zones: Array<{ zone: string; aisles: string[] }>;
}

export interface OccupantItem {
  itemSku: string;
  itemName: string;
  quantity: number;
  lotNumber: string | null;
}

export interface LocationOccupancy {
  location: Location;
  occupied: boolean;
  inventory: OccupantItem[];
}
```

- [ ] **Step 2: Add response schemas**

Append to `src/modules/location/model/schema.ts`:

```typescript
export const bulkCreateResultSchema = z.object({
  success: z.literal(true),
  data: z.object({
    dryRun: z.boolean(),
    created: z.number(),
    skipped: z.array(z.object({ address: z.string(), reason: z.string() })),
  }),
});

export const warehouseStructureResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    zones: z.array(z.object({ zone: z.string(), aisles: z.array(z.string()) })),
  }),
});

export const occupancyResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(
    z.object({
      location: locationDTOSchema,
      occupied: z.boolean(),
      inventory: z.array(
        z.object({
          itemSku: z.string(),
          itemName: z.string(),
          quantity: z.number(),
          lotNumber: z.string().nullable(),
        }),
      ),
    }),
  ),
});
```

- [ ] **Step 3: Add API functions**

In `src/modules/location/api/location.api.ts`, extend the type import and the schema import, then add the functions:

```typescript
// extend existing schema import:
import {
  locationDTOSchema,
  singleResponseSchema,
  paginatedResponseSchema,
  bulkCreateResultSchema,
  warehouseStructureResponseSchema,
  occupancyResponseSchema,
} from '../model/schema';
// extend existing types import:
import {
  Location,
  PaginatedLocation,
  CreateLocationRequest,
  UpdateLocationRequest,
  BulkCreateLocationsRequest,
  BulkCreateResult,
  WarehouseStructure,
  LocationOccupancy,
} from '../model/types';
import { mapLocation } from '../lib/mapLocation';
```

Add these functions at the end of the file:

```typescript
export async function bulkCreateLocations(
  data: BulkCreateLocationsRequest,
  accessToken: string,
): Promise<BulkCreateResult> {
  const raw = await backendFetch('/api/locations/bulk', {
    method: 'POST',
    body: data,
    accessToken,
  });
  return bulkCreateResultSchema.parse(raw).data;
}

export async function getWarehouseStructure(
  warehouseId: string,
  accessToken: string,
): Promise<WarehouseStructure> {
  const raw = await backendFetch(
    `/api/locations/structure?warehouseId=${encodeURIComponent(warehouseId)}`,
    { method: 'GET', accessToken },
  );
  return warehouseStructureResponseSchema.parse(raw).data;
}

export async function getAisleOccupancy(
  params: { warehouseId: string; zone: string; aisle: string },
  accessToken: string,
): Promise<LocationOccupancy[]> {
  const q = new URLSearchParams({
    warehouseId: params.warehouseId,
    zone: params.zone,
    aisle: params.aisle,
  });
  const raw = await backendFetch(`/api/locations/occupancy?${q.toString()}`, {
    method: 'GET',
    accessToken,
  });
  return occupancyResponseSchema.parse(raw).data.map((o) => ({
    location: mapLocation(o.location),
    occupied: o.occupied,
    inventory: o.inventory,
  }));
}
```

- [ ] **Step 4: Write the API test**

Create `src/modules/location/__tests__/location-bulk-map.api.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bulkCreateLocations, getWarehouseStructure, getAisleOccupancy } from '../api/location.api';
import { backendFetch } from '@/services/http/backendClient';

vi.mock('@/services/http/backendClient');
const mockBackendFetch = vi.mocked(backendFetch);
const TOKEN = 'test-access-token';

beforeEach(() => vi.clearAllMocks());

describe('bulkCreateLocations', () => {
  it('posts the payload and returns the parsed result', async () => {
    mockBackendFetch.mockResolvedValue({
      success: true,
      data: { dryRun: true, created: 5, skipped: [{ address: 'A-1-1-1-1', reason: 'address_exists' }] },
    });
    const result = await bulkCreateLocations(
      { locations: [{ zone: 'A', aisle: '1', bay: '1', level: '1', position: '1', warehouseId: '11111111-1111-1111-1111-111111111111' }], dryRun: true },
      TOKEN,
    );
    expect(mockBackendFetch).toHaveBeenCalledWith('/api/locations/bulk', {
      method: 'POST',
      body: expect.objectContaining({ dryRun: true }),
      accessToken: TOKEN,
    });
    expect(result.created).toBe(5);
    expect(result.skipped).toHaveLength(1);
  });
});

describe('getWarehouseStructure', () => {
  it('fetches and returns zones', async () => {
    mockBackendFetch.mockResolvedValue({
      success: true,
      data: { zones: [{ zone: 'A', aisles: ['01', '02'] }] },
    });
    const result = await getWarehouseStructure('wh-1', TOKEN);
    expect(result.zones[0].aisles).toEqual(['01', '02']);
  });
});

describe('getAisleOccupancy', () => {
  it('maps occupancy rows to domain shape', async () => {
    mockBackendFetch.mockResolvedValue({
      success: true,
      data: [
        {
          location: {
            id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            zone: 'A', aisle: '01', bay: '01', level: '1', position: '1',
            locationType: 'storage', capacity: null, maxWeight: null, maxVolume: null,
            dimensions: null, barcode: null, isActive: true, nonPickable: false,
            warehouseId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
            createdAt: '2024-01-15T10:30:00.000Z', updatedAt: '2024-01-15T10:30:00.000Z',
          },
          occupied: true,
          inventory: [{ itemSku: 'SKU1', itemName: 'Widget', quantity: 3, lotNumber: null }],
        },
      ],
    });
    const result = await getAisleOccupancy({ warehouseId: 'wh-1', zone: 'A', aisle: '01' }, TOKEN);
    expect(result[0].occupied).toBe(true);
    expect(result[0].location.createdAt).toBeInstanceOf(Date);
    expect(result[0].inventory[0].itemSku).toBe('SKU1');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd borderworxWMSFrontend && npx vitest run src/modules/location/__tests__/location-bulk-map.api.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
cd borderworxWMSFrontend && git add src/modules/location/model/types.ts src/modules/location/model/schema.ts src/modules/location/api/location.api.ts src/modules/location/__tests__/location-bulk-map.api.test.ts
git commit -m "feat(location): add bulk/structure/occupancy frontend types, schemas, API"
```

---

## Task B4: Routes + sidebar links

**Files:**
- Modify: `borderworxWMSFrontend/src/shared/config/routes.ts`
- Modify: `borderworxWMSFrontend/src/widgets/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Add routes**

In `src/shared/config/routes.ts`, in the `ROUTES` object under the `// Master data` section, after `locations: '/locations',` add:

```typescript
  locationsBulk: '/locations/bulk',
  locationsMap: '/locations/map',
```

In the `PROTECTED_PATHS` array, after `'/locations',` add:

```typescript
  '/locations/bulk',
  '/locations/map',
```

- [ ] **Step 2: Add sidebar links**

In `src/widgets/Sidebar/Sidebar.tsx`, in the `Warehouse` nav section's `children` array, add two entries after `Manage Locations`:

```typescript
      { label: 'Bulk Create Locations', href: ROUTES.locationsBulk },
      { label: 'Warehouse Map', href: ROUTES.locationsMap },
```

- [ ] **Step 3: Typecheck**

Run: `cd borderworxWMSFrontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd borderworxWMSFrontend && git add src/shared/config/routes.ts src/widgets/Sidebar/Sidebar.tsx
git commit -m "feat(location): add bulk + map routes and sidebar links"
```

---

## Task B5: Bulk Create form + page

**Files:**
- Create: `borderworxWMSFrontend/src/modules/location/ui/BulkCreateLocationsForm.tsx`
- Modify: `borderworxWMSFrontend/src/modules/location/index.ts`
- Create: `borderworxWMSFrontend/src/app/(protected)/locations/bulk/page.tsx`

- [ ] **Step 1: Create the form component**

Create `src/modules/location/ui/BulkCreateLocationsForm.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listWarehouses } from '@/modules/warehouse';
import { bulkCreateLocations } from '../api/location.api';
import { expandDimensions } from '../lib/expandRanges';
import { buildBarcode, DEFAULT_BARCODE_PATTERN } from '../lib/buildBarcode';
import type { BulkCreateResult, CreateLocationRequest, LocationType } from '../model/types';

interface Props {
  accessToken: string;
}

const DIMS = ['zone', 'aisle', 'bay', 'level', 'position'] as const;
type Dim = (typeof DIMS)[number];

export function BulkCreateLocationsForm({ accessToken }: Props) {
  const [warehouseId, setWarehouseId] = useState('');
  const [ranges, setRanges] = useState<Record<Dim, string>>({ zone: '', aisle: '', bay: '', level: '', position: '' });
  const [locationType, setLocationType] = useState<LocationType>('storage');
  const [capacity, setCapacity] = useState('');
  const [pattern, setPattern] = useState(DEFAULT_BARCODE_PATTERN);
  const [autoBarcode, setAutoBarcode] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dryResult, setDryResult] = useState<BulkCreateResult | null>(null);
  const [commitResult, setCommitResult] = useState<BulkCreateResult | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: () => listWarehouses({ pageSize: 100 }, accessToken),
    staleTime: 60_000,
  });

  const whCode = useMemo(
    () => warehousesData?.data.find((w) => w.id === warehouseId)?.code ?? '',
    [warehousesData, warehouseId],
  );

  const coords = useMemo(() => {
    try {
      setError(null);
      return expandDimensions(ranges);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid range');
      return [];
    }
  }, [ranges]);

  const requests: CreateLocationRequest[] = useMemo(
    () =>
      coords.map((c) => ({
        ...c,
        warehouseId,
        locationType,
        capacity: capacity.trim() ? Number(capacity) : null,
        barcode: autoBarcode ? buildBarcode(pattern, c, whCode) : null,
      })),
    [coords, warehouseId, locationType, capacity, autoBarcode, pattern, whCode],
  );

  function setRange(dim: Dim, value: string) {
    setRanges((prev) => ({ ...prev, [dim]: value }));
    setDryResult(null);
    setCommitResult(null);
  }

  async function runPreview() {
    if (!warehouseId || requests.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const result = await bulkCreateLocations({ locations: requests, dryRun: true }, accessToken);
      setDryResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Preview failed');
    } finally {
      setBusy(false);
    }
  }

  async function runCommit() {
    setBusy(true);
    setError(null);
    try {
      const result = await bulkCreateLocations({ locations: requests, dryRun: false }, accessToken);
      setCommitResult(result);
      setDryResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">Bulk Create Locations</h1>
      <p className="mb-6 text-sm text-gray-500">
        Enter a list (<code>A, B, C</code>), a range (<code>1-10</code>), or a padded range (<code>01-10</code>) for each
        dimension. Every combination becomes a location.
      </p>

      <section className="mb-6 rounded-xl border border-gray-200 p-5">
        <label className="mb-1.5 block text-sm font-medium text-gray-700">Warehouse</label>
        <select
          value={warehouseId}
          onChange={(e) => { setWarehouseId(e.target.value); setDryResult(null); setCommitResult(null); }}
          className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select a warehouse…</option>
          {(warehousesData?.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
          ))}
        </select>

        <div className="mt-4 grid grid-cols-5 gap-3">
          {DIMS.map((dim) => (
            <div key={dim}>
              <label className="mb-1.5 block text-xs font-medium capitalize text-gray-700">{dim}</label>
              <input
                value={ranges[dim]}
                onChange={(e) => setRange(dim, e.target.value)}
                placeholder={dim === 'zone' ? 'A, B' : '1-10'}
                className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Location Type</label>
            <select
              value={locationType}
              onChange={(e) => setLocationType(e.target.value as LocationType)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {(['storage', 'receiving', 'shipping', 'staging', 'picking', 'overflow'] as LocationType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Capacity (optional)</label>
            <input
              type="number"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              placeholder="units"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={autoBarcode} onChange={(e) => setAutoBarcode(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
            Auto-generate barcode
          </label>
          {autoBarcode && (
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-gray-200 px-3 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          )}
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}

      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong>{requests.length}</strong> location{requests.length === 1 ? '' : 's'} will be generated.
        </p>
        <button
          type="button"
          onClick={runPreview}
          disabled={busy || !warehouseId || requests.length === 0}
          className="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Preview'}
        </button>
      </div>

      {requests.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-400">
              <tr><th className="px-4 py-2">Address</th><th className="px-4 py-2">Barcode</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {requests.slice(0, 50).map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2 text-gray-900">{`${r.zone}-${r.aisle}-${r.bay}-${r.level}-${r.position}`}</td>
                  <td className="px-4 py-2 font-mono text-gray-500">{r.barcode ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length > 50 && (
            <p className="bg-gray-50 px-4 py-2 text-xs text-gray-400">+ {requests.length - 50} more…</p>
          )}
        </div>
      )}

      {dryResult && (
        <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <p className="text-sm text-blue-900">
            <strong>{dryResult.created}</strong> will be created
            {dryResult.skipped.length > 0 && <>, <strong>{dryResult.skipped.length}</strong> skipped (already exist).</>}
          </p>
          {dryResult.skipped.length > 0 && (
            <ul className="mt-2 max-h-32 overflow-y-auto text-xs text-blue-800">
              {dryResult.skipped.slice(0, 30).map((s, i) => (
                <li key={i}>{s.address} — {s.reason}</li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={runCommit}
            disabled={busy || dryResult.created === 0}
            className="mt-4 rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {busy ? 'Creating…' : `Confirm & Create ${dryResult.created}`}
          </button>
        </div>
      )}

      {commitResult && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-sm text-green-900">
          ✅ Created <strong>{commitResult.created}</strong> location{commitResult.created === 1 ? '' : 's'}
          {commitResult.skipped.length > 0 && <>, skipped {commitResult.skipped.length}.</>}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export from the module index**

In `src/modules/location/index.ts`, add to the api re-export block the three new functions, and export the new UI component:

```typescript
export {
  createLocation,
  listLocations,
  getLocationById,
  updateLocation,
  deleteLocation,
  bulkCreateLocations,
  getWarehouseStructure,
  getAisleOccupancy,
} from './api/location.api';

export { BulkCreateLocationsForm } from './ui/BulkCreateLocationsForm';
```

(Keep the existing `mapLocation`, type, and other UI exports as they are.)

- [ ] **Step 3: Create the page**

Create `src/app/(protected)/locations/bulk/page.tsx`:

```tsx
import { getAccessToken } from '@/services/auth/getSession';
import { BulkCreateLocationsForm } from '@/modules/location';

export default async function BulkCreateLocationsPage() {
  const accessToken = await getAccessToken();
  return <BulkCreateLocationsForm accessToken={accessToken!} />;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd borderworxWMSFrontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMSFrontend && git add src/modules/location/ui/BulkCreateLocationsForm.tsx src/modules/location/index.ts "src/app/(protected)/locations/bulk/page.tsx"
git commit -m "feat(location): add bulk-create page"
```

---

# PHASE C — Frontend: Warehouse Map

## Task C1: Warehouse map component + page

**Files:**
- Create: `borderworxWMSFrontend/src/modules/location/ui/WarehouseMap.tsx`
- Modify: `borderworxWMSFrontend/src/modules/location/index.ts`
- Create: `borderworxWMSFrontend/src/app/(protected)/locations/map/page.tsx`

- [ ] **Step 1: Create the map component**

Create `src/modules/location/ui/WarehouseMap.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listWarehouses } from '@/modules/warehouse';
import { getWarehouseStructure, getAisleOccupancy } from '../api/location.api';
import type { LocationOccupancy } from '../model/types';

interface Props {
  accessToken: string;
}

export function WarehouseMap({ accessToken }: Props) {
  const [warehouseId, setWarehouseId] = useState('');
  const [zone, setZone] = useState('');
  const [aisle, setAisle] = useState('');
  const [selected, setSelected] = useState<LocationOccupancy | null>(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses', 'all'],
    queryFn: () => listWarehouses({ pageSize: 100 }, accessToken),
    staleTime: 60_000,
  });

  const { data: structure } = useQuery({
    queryKey: ['location-structure', warehouseId],
    queryFn: () => getWarehouseStructure(warehouseId, accessToken),
    enabled: !!warehouseId,
  });

  const { data: occupancy, isLoading: occLoading } = useQuery({
    queryKey: ['aisle-occupancy', warehouseId, zone, aisle],
    queryFn: () => getAisleOccupancy({ warehouseId, zone, aisle }, accessToken),
    enabled: !!warehouseId && !!zone && !!aisle,
  });

  const aisles = useMemo(
    () => structure?.zones.find((z) => z.zone === zone)?.aisles ?? [],
    [structure, zone],
  );

  // Build a levels × bays grid. Rows = distinct levels (desc), cols = distinct bays (asc).
  const grid = useMemo(() => {
    const rows = occupancy ?? [];
    const levels = [...new Set(rows.map((r) => r.location.level))].sort().reverse();
    const bays = [...new Set(rows.map((r) => r.location.bay))].sort();
    const byCell = new Map<string, LocationOccupancy[]>();
    for (const r of rows) {
      const key = `${r.location.level}|${r.location.bay}`;
      byCell.set(key, [...(byCell.get(key) ?? []), r]);
    }
    return { levels, bays, byCell };
  }, [occupancy]);

  function cellColor(o: LocationOccupancy): string {
    if (!o.location.isActive) return 'bg-gray-300 text-gray-600';
    return o.occupied ? 'bg-blue-600 text-white' : 'bg-green-500 text-white';
  }

  return (
    <div className="px-6 py-6">
      <h1 className="mb-4 text-xl font-semibold text-gray-900">Warehouse Map</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <select
          value={warehouseId}
          onChange={(e) => { setWarehouseId(e.target.value); setZone(''); setAisle(''); setSelected(null); }}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select warehouse…</option>
          {(warehousesData?.data ?? []).map((w) => (
            <option key={w.id} value={w.id}>{w.name} ({w.code})</option>
          ))}
        </select>

        <select
          value={zone}
          onChange={(e) => { setZone(e.target.value); setAisle(''); setSelected(null); }}
          disabled={!structure}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select zone…</option>
          {(structure?.zones ?? []).map((z) => (
            <option key={z.zone} value={z.zone}>{z.zone}</option>
          ))}
        </select>

        <select
          value={aisle}
          onChange={(e) => { setAisle(e.target.value); setSelected(null); }}
          disabled={!zone}
          className="h-10 rounded-lg border border-gray-200 px-3 text-sm disabled:opacity-50 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Select aisle…</option>
          {aisles.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div className="mb-4 flex gap-4 text-xs text-gray-600">
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-500" /> Empty</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-blue-600" /> Occupied</span>
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gray-300" /> Inactive</span>
      </div>

      {!aisle ? (
        <p className="text-sm text-gray-400">Select a warehouse, zone, and aisle to view the rack.</p>
      ) : occLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : grid.levels.length === 0 ? (
        <p className="text-sm text-gray-400">No locations in this aisle.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 p-4">
          <table className="border-separate" style={{ borderSpacing: '6px' }}>
            <tbody>
              {grid.levels.map((lvl) => (
                <tr key={lvl}>
                  <td className="pr-2 text-right text-xs font-semibold text-gray-500">Lvl {lvl}</td>
                  {grid.bays.map((bay) => {
                    const cell = grid.byCell.get(`${lvl}|${bay}`) ?? [];
                    return (
                      <td key={bay}>
                        <div className="flex gap-1">
                          {cell.length === 0 ? (
                            <div className="h-10 w-12 rounded border border-dashed border-gray-200" />
                          ) : (
                            cell.map((o) => (
                              <button
                                key={o.location.id}
                                type="button"
                                onClick={() => setSelected(o)}
                                title={`${o.location.zone}-${o.location.aisle}-${o.location.bay}-${o.location.level}-${o.location.position}`}
                                className={`flex h-10 w-12 items-center justify-center rounded text-[10px] font-semibold ${cellColor(o)}`}
                              >
                                B{o.location.bay}·P{o.location.position}
                              </button>
                            ))
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td />
                {grid.bays.map((bay) => (
                  <td key={bay} className="pt-1 text-center text-xs text-gray-400">Bay {bay}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setSelected(null)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {`${selected.location.zone}-${selected.location.aisle}-${selected.location.bay}-${selected.location.level}-${selected.location.position}`}
              </h2>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Type</dt><dd className="text-gray-900">{selected.location.locationType}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Capacity</dt><dd className="text-gray-900">{selected.location.capacity ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Barcode</dt><dd className="font-mono text-gray-900">{selected.location.barcode ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Status</dt><dd className="text-gray-900">{selected.occupied ? 'Occupied' : 'Empty'}{selected.location.isActive ? '' : ' (inactive)'}</dd></div>
            </dl>
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-400">Inventory</p>
              {selected.inventory.length === 0 ? (
                <p className="text-sm text-gray-400">Empty.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {selected.inventory.map((inv, i) => (
                    <li key={i} className="flex justify-between">
                      <span className="text-gray-900">{inv.itemSku} — {inv.itemName}{inv.lotNumber ? ` (lot ${inv.lotNumber})` : ''}</span>
                      <span className="text-gray-500">×{inv.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Export from the module index**

In `src/modules/location/index.ts`, add:

```typescript
export { WarehouseMap } from './ui/WarehouseMap';
```

- [ ] **Step 3: Create the page**

Create `src/app/(protected)/locations/map/page.tsx`:

```tsx
import { getAccessToken } from '@/services/auth/getSession';
import { WarehouseMap } from '@/modules/location';

export default async function WarehouseMapPage() {
  const accessToken = await getAccessToken();
  return <WarehouseMap accessToken={accessToken!} />;
}
```

- [ ] **Step 4: Typecheck**

Run: `cd borderworxWMSFrontend && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd borderworxWMSFrontend && git add src/modules/location/ui/WarehouseMap.tsx src/modules/location/index.ts "src/app/(protected)/locations/map/page.tsx"
git commit -m "feat(location): add warehouse map page"
```

---

# PHASE D — Verification

## Task D1: Full test + build verification

- [ ] **Step 1: Backend — full suite + typecheck**

Run: `cd borderworxWMS && npx tsc --noEmit && npx vitest run`
Expected: typecheck PASS; all tests PASS (including the two new use-case test files).

- [ ] **Step 2: Frontend — full suite + typecheck**

Run: `cd borderworxWMSFrontend && npx tsc --noEmit && npx vitest run`
Expected: typecheck PASS; all tests PASS (including the three new test files).

- [ ] **Step 3: Frontend production build**

Run: `cd borderworxWMSFrontend && npm run build`
Expected: build succeeds; `/locations/bulk` and `/locations/map` appear in the route output.

- [ ] **Step 4: Manual smoke test (requires backend + frontend running)**

Start both apps. Then:
1. Sidebar → Warehouse → **Bulk Create Locations**. Pick a warehouse, enter `zone=A`, `aisle=1-2`, `bay=1-2`, `level=1`, `position=1`. Confirm "4 locations will be generated", barcodes show. Click **Preview** → confirm counts. Click **Confirm & Create** → success banner.
2. Re-run the same Preview → should now report all 4 skipped (`address_exists`).
3. Sidebar → Warehouse → **Warehouse Map**. Pick the same warehouse → Zone A → Aisle 1. Grid renders with green (empty) cells. Click a cell → popover shows address/type/barcode and empty inventory.

Report results to the user. Do not claim success without observing these outcomes.

- [ ] **Step 5: Final commit (if any docs/touch-ups)**

```bash
git status
# commit anything outstanding with an appropriate message
```

---

## Notes for the implementer

- **Route ordering** (Task A8) is the single most common failure mode — `/structure` and `/occupancy` MUST be registered before `/:id` or they 404 as "location not found".
- **`createMany` + `skipDuplicates`** relies on the unique index from Task A1. The use-case still pre-checks so it can *report* what was skipped (skipDuplicates is silent). Both layers are intentional.
- **Occupancy is binary**: occupied = at least one inventory row with `quantity > 0`. Inactive slots render gray regardless.
- Follow the existing Tailwind/blue-600 visual language already used across the app (see `CreateLocationForm.tsx`).
