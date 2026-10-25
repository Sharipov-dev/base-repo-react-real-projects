# UOM Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a global Unit of Measure library with full CRUD for UnitOfMeasure, UomConversion, and EquivalencyGroup; replace Item.unitOfMeasure string with a proper FK; and expose a 3-tab UOM management page under the Items section.

**Architecture:** Clean Architecture backend (domain → application → infrastructure → interfaces). Three new Prisma models plus Item FK migration. New frontend module under src/modules/uom/ with a page at /items/uom.

**Tech Stack:** Node.js + Express + Prisma + Zod + Vitest (backend); Next.js 15 App Router + TypeScript + Tailwind + React Query (frontend).

---

## Task 1: Prisma Schema + Migration

- [ ] **1.1** Open `borderworxWMS/prisma/schema.prisma`. Add the following enums after the existing `ValuationMethod` enum (around line 193):

```prisma
enum UomType {
  COUNT
  WEIGHT
  VOLUME
  LENGTH
  AREA
}

enum RoundingRule {
  NEAREST
  UP
  DOWN
}

enum EquivalencyGroupType {
  WEIGHT
  VOLUME
  COUNT
  LENGTH
  AREA
}
```

- [ ] **1.2** Add the following three new models after the `ItemStorageCharge` model (near the end of the schema):

```prisma
model UnitOfMeasure {
  id           String   @id @default(uuid())
  code         String   @unique
  name         String
  description  String?
  uomType      UomType  @map("uom_type")
  roundingRule RoundingRule @default(NEAREST) @map("rounding_rule")
  decimalPlaces Int     @default(2) @map("decimal_places")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  items              Item[]
  fromConversions    UomConversion[] @relation("FromUom")
  toConversions      UomConversion[] @relation("ToUom")
  equivalencyMembers EquivalencyGroupMember[]

  @@map("unit_of_measure")
}

model UomConversion {
  id               String   @id @default(uuid())
  fromUomId        String   @map("from_uom_id")
  toUomId          String   @map("to_uom_id")
  conversionFactor Float    @map("conversion_factor")
  hierarchyLevel   Int      @default(0) @map("hierarchy_level")
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  fromUom UnitOfMeasure @relation("FromUom", fields: [fromUomId], references: [id])
  toUom   UnitOfMeasure @relation("ToUom", fields: [toUomId], references: [id])

  @@unique([fromUomId, toUomId])
  @@map("uom_conversion")
}

model EquivalencyGroup {
  id          String               @id @default(uuid())
  name        String
  description String?
  groupType   EquivalencyGroupType @map("group_type")
  isActive    Boolean              @default(true) @map("is_active")
  createdAt   DateTime             @default(now()) @map("created_at")
  updatedAt   DateTime             @updatedAt @map("updated_at")

  members EquivalencyGroupMember[]

  @@map("equivalency_group")
}

model EquivalencyGroupMember {
  id        String   @id @default(uuid())
  groupId   String   @map("group_id")
  uomId     String   @map("uom_id")
  isPrimary Boolean  @default(false) @map("is_primary")
  createdAt DateTime @default(now()) @map("created_at")

  group EquivalencyGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)
  uom   UnitOfMeasure    @relation(fields: [uomId], references: [id])

  @@unique([groupId, uomId])
  @@map("equivalency_group_member")
}
```

- [ ] **1.3** In the `Item` model, replace:
```prisma
  unitOfMeasure         String           @default("EACH") @map("unit_of_measure")
```
with:
```prisma
  unitOfMeasureId       String?          @map("unit_of_measure_id")
```
And add the relation line inside the `Item` model's relations block (after the `customer` relation):
```prisma
  unitOfMeasure      UnitOfMeasure?     @relation(fields: [unitOfMeasureId], references: [id])
```

- [ ] **1.4** Run the migration:
```bash
cd borderworxWMS && npx prisma migrate dev --name add-uom-management
```

- [ ] **1.5** Commit:
```bash
git add borderworxWMS/prisma/schema.prisma borderworxWMS/prisma/migrations/
git commit -m "chore: add UOM management prisma schema and migration"
```

---

## Task 2: UnitOfMeasure Backend Stack

- [ ] **2.1** Create `borderworxWMS/src/domain/entities/unit-of-measure.entity.ts`:

```typescript
export type UomType = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA';
export type RoundingRule = 'NEAREST' | 'UP' | 'DOWN';

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
  description: string | null;
  uomType: UomType;
  roundingRule: RoundingRule;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUnitOfMeasureData {
  code: string;
  name: string;
  description?: string | null;
  uomType: UomType;
  roundingRule?: RoundingRule;
  decimalPlaces?: number;
  isActive?: boolean;
}

export interface UpdateUnitOfMeasureData {
  name?: string;
  description?: string | null;
  uomType?: UomType;
  roundingRule?: RoundingRule;
  decimalPlaces?: number;
  isActive?: boolean;
}
```

- [ ] **2.2** Create `borderworxWMS/src/domain/repositories/unit-of-measure.repository.ts`:

```typescript
import type { CreateUnitOfMeasureData, UnitOfMeasure, UpdateUnitOfMeasureData } from '../entities/unit-of-measure.entity.js';

export interface FindAllUomOptions {
  skip?: number;
  take?: number;
  search?: string;
  uomType?: string;
  isActive?: boolean;
}

export interface UnitOfMeasureRepository {
  findById(id: string): Promise<UnitOfMeasure | null>;
  findByCode(code: string): Promise<UnitOfMeasure | null>;
  findAll(options?: FindAllUomOptions): Promise<UnitOfMeasure[]>;
  count(options?: FindAllUomOptions): Promise<number>;
  create(data: CreateUnitOfMeasureData): Promise<UnitOfMeasure>;
  update(id: string, data: UpdateUnitOfMeasureData): Promise<UnitOfMeasure>;
  delete(id: string): Promise<void>;
  isReferencedByItem(id: string): Promise<boolean>;
}
```

- [ ] **2.3** Create `borderworxWMS/src/domain/errors/unit-of-measure.errors.ts`:

```typescript
import { NotFoundError, ConflictError } from '../../shared/errors/app-error.js';

export class UnitOfMeasureNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Unit of measure not found: ${id}`);
  }
}

export class UnitOfMeasureCodeAlreadyExistsError extends ConflictError {
  constructor(code: string) {
    super(`Unit of measure with code '${code}' already exists`);
  }
}

export class UnitOfMeasureReferencedByItemError extends ConflictError {
  constructor(id: string) {
    super(`Unit of measure '${id}' is referenced by one or more items and cannot be deleted`);
  }
}
```

- [ ] **2.4** Create `borderworxWMS/src/application/dto/unit-of-measure.dto.ts`:

```typescript
import { z } from 'zod';

const uomTypeSchema = z.enum(['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA']);
const roundingRuleSchema = z.enum(['NEAREST', 'UP', 'DOWN']);

export const createUnitOfMeasureSchema = z.object({
  code: z.string().min(1).max(20).transform((v) => v.toUpperCase()),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  uomType: uomTypeSchema,
  roundingRule: roundingRuleSchema.optional(),
  decimalPlaces: z.number().int().min(0).max(10).optional(),
  isActive: z.boolean().optional(),
});

export const updateUnitOfMeasureSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    uomType: uomTypeSchema.optional(),
    roundingRule: roundingRuleSchema.optional(),
    decimalPlaces: z.number().int().min(0).max(10).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field required',
  });

export const listUomQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  uomType: uomTypeSchema.optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export const uomIdParamSchema = z.object({ id: z.string().uuid() });

export type CreateUnitOfMeasureDto = z.infer<typeof createUnitOfMeasureSchema>;
export type UpdateUnitOfMeasureDto = z.infer<typeof updateUnitOfMeasureSchema>;
export type ListUomQueryDto = z.infer<typeof listUomQuerySchema>;

export interface UnitOfMeasureResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  uomType: 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA';
  roundingRule: 'NEAREST' | 'UP' | 'DOWN';
  decimalPlaces: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **2.5** Create `borderworxWMS/src/application/use-cases/unit-of-measure/create-unit-of-measure.use-case.ts`:

```typescript
import type { UnitOfMeasure, CreateUnitOfMeasureData } from '../../../domain/entities/unit-of-measure.entity.js';
import { UnitOfMeasureCodeAlreadyExistsError } from '../../../domain/errors/unit-of-measure.errors.js';
import type { UnitOfMeasureRepository } from '../../../domain/repositories/unit-of-measure.repository.js';

export class CreateUnitOfMeasureUseCase {
  constructor(private readonly repo: UnitOfMeasureRepository) {}

  async execute(data: CreateUnitOfMeasureData): Promise<UnitOfMeasure> {
    const existing = await this.repo.findByCode(data.code);
    if (existing) {
      throw new UnitOfMeasureCodeAlreadyExistsError(data.code);
    }
    return this.repo.create(data);
  }
}
```

- [ ] **2.6** Create `borderworxWMS/src/application/use-cases/unit-of-measure/list-unit-of-measure.use-case.ts`:

```typescript
import type { UnitOfMeasure } from '../../../domain/entities/unit-of-measure.entity.js';
import type { UnitOfMeasureRepository, FindAllUomOptions } from '../../../domain/repositories/unit-of-measure.repository.js';
import type { PaginationMeta } from '../../../shared/utils/pagination.js';
import { calculatePagination, createPaginationMeta } from '../../../shared/utils/pagination.js';

export class ListUnitOfMeasureUseCase {
  constructor(private readonly repo: UnitOfMeasureRepository) {}

  async execute(options: {
    page?: number;
    pageSize?: number;
    search?: string;
    uomType?: string;
    isActive?: boolean;
  }): Promise<{ items: UnitOfMeasure[]; meta: PaginationMeta }> {
    const page = options.page ?? 1;
    const pageSize = options.pageSize ?? 20;
    const { skip, take } = calculatePagination({ page, pageSize });

    const findOptions: FindAllUomOptions = {
      skip,
      take,
      search: options.search,
      uomType: options.uomType,
      isActive: options.isActive,
    };

    const [items, total] = await Promise.all([
      this.repo.findAll(findOptions),
      this.repo.count({ search: options.search, uomType: options.uomType, isActive: options.isActive }),
    ]);

    return { items, meta: createPaginationMeta(page, pageSize, total) };
  }
}
```

- [ ] **2.7** Create `borderworxWMS/src/application/use-cases/unit-of-measure/update-unit-of-measure.use-case.ts`:

```typescript
import type { UnitOfMeasure, UpdateUnitOfMeasureData } from '../../../domain/entities/unit-of-measure.entity.js';
import { UnitOfMeasureNotFoundError } from '../../../domain/errors/unit-of-measure.errors.js';
import type { UnitOfMeasureRepository } from '../../../domain/repositories/unit-of-measure.repository.js';

export class UpdateUnitOfMeasureUseCase {
  constructor(private readonly repo: UnitOfMeasureRepository) {}

  async execute(id: string, data: UpdateUnitOfMeasureData): Promise<UnitOfMeasure> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new UnitOfMeasureNotFoundError(id);
    }
    return this.repo.update(id, data);
  }
}
```

- [ ] **2.8** Create `borderworxWMS/src/application/use-cases/unit-of-measure/delete-unit-of-measure.use-case.ts`:

```typescript
import { UnitOfMeasureNotFoundError, UnitOfMeasureReferencedByItemError } from '../../../domain/errors/unit-of-measure.errors.js';
import type { UnitOfMeasureRepository } from '../../../domain/repositories/unit-of-measure.repository.js';

export class DeleteUnitOfMeasureUseCase {
  constructor(private readonly repo: UnitOfMeasureRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new UnitOfMeasureNotFoundError(id);
    }
    const referenced = await this.repo.isReferencedByItem(id);
    if (referenced) {
      throw new UnitOfMeasureReferencedByItemError(id);
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **2.9** Create `borderworxWMS/src/infrastructure/repositories/unit-of-measure.mapper.ts`:

```typescript
import type { UnitOfMeasure as PrismaUom } from '@prisma/client';
import type { UnitOfMeasure } from '../../domain/entities/unit-of-measure.entity.js';

export class UnitOfMeasureMapper {
  static toDomain(r: PrismaUom): UnitOfMeasure {
    return {
      id: r.id,
      code: r.code,
      name: r.name,
      description: r.description,
      uomType: r.uomType as UnitOfMeasure['uomType'],
      roundingRule: r.roundingRule as UnitOfMeasure['roundingRule'],
      decimalPlaces: r.decimalPlaces,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  static toDomainList(rs: PrismaUom[]): UnitOfMeasure[] {
    return rs.map(UnitOfMeasureMapper.toDomain);
  }
}
```

- [ ] **2.10** Create `borderworxWMS/src/infrastructure/repositories/prisma-unit-of-measure.repository.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import type { CreateUnitOfMeasureData, UnitOfMeasure, UpdateUnitOfMeasureData } from '../../domain/entities/unit-of-measure.entity.js';
import type { FindAllUomOptions, UnitOfMeasureRepository } from '../../domain/repositories/unit-of-measure.repository.js';
import { UnitOfMeasureMapper } from './unit-of-measure.mapper.js';

function buildWhere(options?: FindAllUomOptions) {
  const where: Record<string, unknown> = {};
  if (options?.search) {
    where['OR'] = [
      { code: { contains: options.search, mode: 'insensitive' } },
      { name: { contains: options.search, mode: 'insensitive' } },
    ];
  }
  if (options?.uomType) where['uomType'] = options.uomType;
  if (options?.isActive !== undefined) where['isActive'] = options.isActive;
  return where;
}

export class PrismaUnitOfMeasureRepository implements UnitOfMeasureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UnitOfMeasure | null> {
    const r = await this.prisma.unitOfMeasure.findUnique({ where: { id } });
    return r ? UnitOfMeasureMapper.toDomain(r) : null;
  }

  async findByCode(code: string): Promise<UnitOfMeasure | null> {
    const r = await this.prisma.unitOfMeasure.findUnique({ where: { code } });
    return r ? UnitOfMeasureMapper.toDomain(r) : null;
  }

  async findAll(options?: FindAllUomOptions): Promise<UnitOfMeasure[]> {
    const where = buildWhere(options);
    const records = await this.prisma.unitOfMeasure.findMany({
      where,
      ...(options?.skip !== undefined && { skip: options.skip }),
      ...(options?.take !== undefined && { take: options.take }),
      orderBy: { code: 'asc' },
    });
    return UnitOfMeasureMapper.toDomainList(records);
  }

  async count(options?: FindAllUomOptions): Promise<number> {
    return this.prisma.unitOfMeasure.count({ where: buildWhere(options) });
  }

  async create(data: CreateUnitOfMeasureData): Promise<UnitOfMeasure> {
    const r = await this.prisma.unitOfMeasure.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        uomType: data.uomType,
        roundingRule: data.roundingRule ?? 'NEAREST',
        decimalPlaces: data.decimalPlaces ?? 2,
        isActive: data.isActive ?? true,
      },
    });
    return UnitOfMeasureMapper.toDomain(r);
  }

  async update(id: string, data: UpdateUnitOfMeasureData): Promise<UnitOfMeasure> {
    const r = await this.prisma.unitOfMeasure.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.uomType !== undefined && { uomType: data.uomType }),
        ...(data.roundingRule !== undefined && { roundingRule: data.roundingRule }),
        ...(data.decimalPlaces !== undefined && { decimalPlaces: data.decimalPlaces }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });
    return UnitOfMeasureMapper.toDomain(r);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.unitOfMeasure.delete({ where: { id } });
  }

  async isReferencedByItem(id: string): Promise<boolean> {
    const count = await this.prisma.item.count({ where: { unitOfMeasureId: id } });
    return count > 0;
  }
}
```

- [ ] **2.11** Create `borderworxWMS/src/interfaces/http/controllers/unit-of-measure.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import type { CreateUnitOfMeasureUseCase } from '../../../application/use-cases/unit-of-measure/create-unit-of-measure.use-case.js';
import type { ListUnitOfMeasureUseCase } from '../../../application/use-cases/unit-of-measure/list-unit-of-measure.use-case.js';
import type { UpdateUnitOfMeasureUseCase } from '../../../application/use-cases/unit-of-measure/update-unit-of-measure.use-case.js';
import type { DeleteUnitOfMeasureUseCase } from '../../../application/use-cases/unit-of-measure/delete-unit-of-measure.use-case.js';
import type { UnitOfMeasure } from '../../../domain/entities/unit-of-measure.entity.js';
import type { CreateUnitOfMeasureDto, UpdateUnitOfMeasureDto, UnitOfMeasureResponseDto } from '../../../application/dto/unit-of-measure.dto.js';
import type { ListUomQueryDto } from '../../../application/dto/unit-of-measure.dto.js';
import { sendCreated, sendNoContent, sendPaginated, sendSuccess } from '../../../shared/utils/response.js';

function toUomResponse(uom: UnitOfMeasure): UnitOfMeasureResponseDto {
  return {
    id: uom.id,
    code: uom.code,
    name: uom.name,
    description: uom.description,
    uomType: uom.uomType,
    roundingRule: uom.roundingRule,
    decimalPlaces: uom.decimalPlaces,
    isActive: uom.isActive,
    createdAt: uom.createdAt.toISOString(),
    updatedAt: uom.updatedAt.toISOString(),
  };
}

export class UnitOfMeasureController {
  constructor(
    private readonly createUseCase: CreateUnitOfMeasureUseCase,
    private readonly listUseCase: ListUnitOfMeasureUseCase,
    private readonly updateUseCase: UpdateUnitOfMeasureUseCase,
    private readonly deleteUseCase: DeleteUnitOfMeasureUseCase,
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateUnitOfMeasureDto;
    const uom = await this.createUseCase.execute(body);
    sendCreated(res, toUomResponse(uom));
  }

  async list(req: Request, res: Response): Promise<void> {
    const query = req.query as unknown as ListUomQueryDto;
    const result = await this.listUseCase.execute(query);
    sendPaginated(res, { items: result.items.map(toUomResponse), meta: result.meta });
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateUnitOfMeasureDto;
    const uom = await this.updateUseCase.execute(id, body);
    sendSuccess(res, toUomResponse(uom));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    await this.deleteUseCase.execute(id);
    sendNoContent(res);
  }
}
```

- [ ] **2.12** Create `borderworxWMS/src/interfaces/http/routes/unit-of-measure.routes.ts`:

```typescript
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { createUnitOfMeasureSchema, updateUnitOfMeasureSchema, uomIdParamSchema, listUomQuerySchema } from '../../../application/dto/unit-of-measure.dto.js';
import type { UnitOfMeasureController } from '../controllers/unit-of-measure.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { validate } from '../middlewares/validate.middleware.js';

export function createUnitOfMeasureRoutes(controller: UnitOfMeasureController, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    validate({ body: createUnitOfMeasureSchema }),
    asyncHandler(async (req, res) => { await controller.create(req, res); }),
  );

  router.get(
    '/',
    authMiddleware,
    validate({ query: listUomQuerySchema }),
    asyncHandler(async (req, res) => { await controller.list(req, res); }),
  );

  router.patch(
    '/:id',
    authMiddleware,
    validate({ params: uomIdParamSchema, body: updateUnitOfMeasureSchema }),
    asyncHandler(async (req, res) => { await controller.update(req, res); }),
  );

  router.delete(
    '/:id',
    authMiddleware,
    validate({ params: uomIdParamSchema }),
    asyncHandler(async (req, res) => { await controller.delete(req, res); }),
  );

  return router;
}
```

- [ ] **2.13** Create `borderworxWMS/tests/unit/use-cases/create-unit-of-measure.use-case.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateUnitOfMeasureUseCase } from '../../../src/application/use-cases/unit-of-measure/create-unit-of-measure.use-case.js';
import type { UnitOfMeasure } from '../../../src/domain/entities/unit-of-measure.entity.js';
import { UnitOfMeasureCodeAlreadyExistsError } from '../../../src/domain/errors/unit-of-measure.errors.js';
import type { UnitOfMeasureRepository } from '../../../src/domain/repositories/unit-of-measure.repository.js';

describe('CreateUnitOfMeasureUseCase', () => {
  let useCase: CreateUnitOfMeasureUseCase;
  let mockRepo: UnitOfMeasureRepository;

  const mockUom: UnitOfMeasure = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    code: 'EACH',
    name: 'Each',
    description: null,
    uomType: 'COUNT',
    roundingRule: 'NEAREST',
    decimalPlaces: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByCode: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      isReferencedByItem: vi.fn(),
    };
    useCase = new CreateUnitOfMeasureUseCase(mockRepo);
  });

  it('should create a UOM when code does not exist', async () => {
    vi.mocked(mockRepo.findByCode).mockResolvedValue(null);
    vi.mocked(mockRepo.create).mockResolvedValue(mockUom);

    const result = await useCase.execute({ code: 'EACH', name: 'Each', uomType: 'COUNT' });

    expect(mockRepo.findByCode).toHaveBeenCalledWith('EACH');
    expect(mockRepo.create).toHaveBeenCalled();
    expect(result).toEqual(mockUom);
  });

  it('should throw UnitOfMeasureCodeAlreadyExistsError when code exists', async () => {
    vi.mocked(mockRepo.findByCode).mockResolvedValue(mockUom);

    await expect(
      useCase.execute({ code: 'EACH', name: 'Each', uomType: 'COUNT' }),
    ).rejects.toThrow(UnitOfMeasureCodeAlreadyExistsError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });

  it('should include the conflicting code in the error message', async () => {
    vi.mocked(mockRepo.findByCode).mockResolvedValue(mockUom);

    try {
      await useCase.execute({ code: 'EACH', name: 'Each', uomType: 'COUNT' });
      expect.fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(UnitOfMeasureCodeAlreadyExistsError);
      expect((error as UnitOfMeasureCodeAlreadyExistsError).message).toContain('EACH');
    }
  });
});
```

- [ ] **2.14** Create `borderworxWMS/tests/unit/use-cases/delete-unit-of-measure.use-case.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeleteUnitOfMeasureUseCase } from '../../../src/application/use-cases/unit-of-measure/delete-unit-of-measure.use-case.js';
import type { UnitOfMeasure } from '../../../src/domain/entities/unit-of-measure.entity.js';
import { UnitOfMeasureNotFoundError, UnitOfMeasureReferencedByItemError } from '../../../src/domain/errors/unit-of-measure.errors.js';
import type { UnitOfMeasureRepository } from '../../../src/domain/repositories/unit-of-measure.repository.js';

describe('DeleteUnitOfMeasureUseCase', () => {
  let useCase: DeleteUnitOfMeasureUseCase;
  let mockRepo: UnitOfMeasureRepository;

  const mockUom: UnitOfMeasure = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    code: 'EACH',
    name: 'Each',
    description: null,
    uomType: 'COUNT',
    roundingRule: 'NEAREST',
    decimalPlaces: 0,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByCode: vi.fn(),
      findAll: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      isReferencedByItem: vi.fn(),
    };
    useCase = new DeleteUnitOfMeasureUseCase(mockRepo);
  });

  it('should delete a UOM that exists and is not referenced', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(mockUom);
    vi.mocked(mockRepo.isReferencedByItem).mockResolvedValue(false);
    vi.mocked(mockRepo.delete).mockResolvedValue(undefined);

    await useCase.execute(mockUom.id);

    expect(mockRepo.findById).toHaveBeenCalledWith(mockUom.id);
    expect(mockRepo.isReferencedByItem).toHaveBeenCalledWith(mockUom.id);
    expect(mockRepo.delete).toHaveBeenCalledWith(mockUom.id);
  });

  it('should throw UnitOfMeasureNotFoundError when UOM does not exist', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(null);

    await expect(useCase.execute('non-existent-id')).rejects.toThrow(UnitOfMeasureNotFoundError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });

  it('should throw UnitOfMeasureReferencedByItemError when UOM is in use', async () => {
    vi.mocked(mockRepo.findById).mockResolvedValue(mockUom);
    vi.mocked(mockRepo.isReferencedByItem).mockResolvedValue(true);

    await expect(useCase.execute(mockUom.id)).rejects.toThrow(UnitOfMeasureReferencedByItemError);
    expect(mockRepo.delete).not.toHaveBeenCalled();
  });
});
```

- [ ] **2.15** Run tests:
```bash
cd borderworxWMS && npx vitest run tests/unit/use-cases/create-unit-of-measure.use-case.test.ts tests/unit/use-cases/delete-unit-of-measure.use-case.test.ts
```

- [ ] **2.16** Commit:
```bash
git add borderworxWMS/src/domain/entities/unit-of-measure.entity.ts \
  borderworxWMS/src/domain/repositories/unit-of-measure.repository.ts \
  borderworxWMS/src/domain/errors/unit-of-measure.errors.ts \
  borderworxWMS/src/application/dto/unit-of-measure.dto.ts \
  borderworxWMS/src/application/use-cases/unit-of-measure/ \
  borderworxWMS/src/infrastructure/repositories/unit-of-measure.mapper.ts \
  borderworxWMS/src/infrastructure/repositories/prisma-unit-of-measure.repository.ts \
  borderworxWMS/src/interfaces/http/controllers/unit-of-measure.controller.ts \
  borderworxWMS/src/interfaces/http/routes/unit-of-measure.routes.ts \
  borderworxWMS/tests/unit/use-cases/create-unit-of-measure.use-case.test.ts \
  borderworxWMS/tests/unit/use-cases/delete-unit-of-measure.use-case.test.ts
git commit -m "feat: add UnitOfMeasure backend stack (domain → infra → interfaces)"
```

---

## Task 3: UomConversion Backend Stack

- [ ] **3.1** Create `borderworxWMS/src/domain/entities/uom-conversion.entity.ts`:

```typescript
export interface UomConversion {
  id: string;
  fromUomId: string;
  toUomId: string;
  fromUomCode: string;
  fromUomName: string;
  toUomCode: string;
  toUomName: string;
  conversionFactor: number;
  hierarchyLevel: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUomConversionData {
  fromUomId: string;
  toUomId: string;
  conversionFactor: number;
  hierarchyLevel?: number;
  isActive?: boolean;
}

export interface UpdateUomConversionData {
  conversionFactor?: number;
  hierarchyLevel?: number;
  isActive?: boolean;
}
```

- [ ] **3.2** Create `borderworxWMS/src/domain/repositories/uom-conversion.repository.ts`:

```typescript
import type { CreateUomConversionData, UomConversion, UpdateUomConversionData } from '../entities/uom-conversion.entity.js';

export interface UomConversionRepository {
  findAll(fromUomId?: string): Promise<UomConversion[]>;
  findById(id: string): Promise<UomConversion | null>;
  findByPair(fromUomId: string, toUomId: string): Promise<UomConversion | null>;
  create(data: CreateUomConversionData): Promise<UomConversion>;
  update(id: string, data: UpdateUomConversionData): Promise<UomConversion>;
  delete(id: string): Promise<void>;
}
```

- [ ] **3.3** Create `borderworxWMS/src/domain/errors/uom-conversion.errors.ts`:

```typescript
import { NotFoundError, ConflictError } from '../../shared/errors/app-error.js';

export class UomConversionNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`UOM conversion not found: ${id}`);
  }
}

export class UomConversionPairAlreadyExistsError extends ConflictError {
  constructor(fromUomId: string, toUomId: string) {
    super(`A conversion from '${fromUomId}' to '${toUomId}' already exists`);
  }
}
```

- [ ] **3.4** Create `borderworxWMS/src/application/dto/uom-conversion.dto.ts`:

```typescript
import { z } from 'zod';

export const createUomConversionSchema = z.object({
  fromUomId: z.string().uuid(),
  toUomId: z.string().uuid(),
  conversionFactor: z.number().positive(),
  hierarchyLevel: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

export const updateUomConversionSchema = z
  .object({
    conversionFactor: z.number().positive().optional(),
    hierarchyLevel: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field required',
  });

export const uomConversionIdParamSchema = z.object({ id: z.string().uuid() });

export const listUomConversionQuerySchema = z.object({
  fromUomId: z.string().uuid().optional(),
});

export type CreateUomConversionDto = z.infer<typeof createUomConversionSchema>;
export type UpdateUomConversionDto = z.infer<typeof updateUomConversionSchema>;

export interface UomConversionResponseDto {
  id: string;
  fromUomId: string;
  toUomId: string;
  fromUomCode: string;
  fromUomName: string;
  toUomCode: string;
  toUomName: string;
  conversionFactor: number;
  hierarchyLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **3.5** Create `borderworxWMS/src/application/use-cases/uom-conversion/create-uom-conversion.use-case.ts`:

```typescript
import type { UomConversion, CreateUomConversionData } from '../../../domain/entities/uom-conversion.entity.js';
import { UomConversionPairAlreadyExistsError } from '../../../domain/errors/uom-conversion.errors.js';
import type { UomConversionRepository } from '../../../domain/repositories/uom-conversion.repository.js';

export class CreateUomConversionUseCase {
  constructor(private readonly repo: UomConversionRepository) {}

  async execute(data: CreateUomConversionData): Promise<UomConversion> {
    const existing = await this.repo.findByPair(data.fromUomId, data.toUomId);
    if (existing) {
      throw new UomConversionPairAlreadyExistsError(data.fromUomId, data.toUomId);
    }
    return this.repo.create(data);
  }
}
```

- [ ] **3.6** Create `borderworxWMS/src/application/use-cases/uom-conversion/list-uom-conversion.use-case.ts`:

```typescript
import type { UomConversion } from '../../../domain/entities/uom-conversion.entity.js';
import type { UomConversionRepository } from '../../../domain/repositories/uom-conversion.repository.js';

export class ListUomConversionUseCase {
  constructor(private readonly repo: UomConversionRepository) {}

  async execute(fromUomId?: string): Promise<UomConversion[]> {
    return this.repo.findAll(fromUomId);
  }
}
```

- [ ] **3.7** Create `borderworxWMS/src/application/use-cases/uom-conversion/update-uom-conversion.use-case.ts`:

```typescript
import type { UomConversion, UpdateUomConversionData } from '../../../domain/entities/uom-conversion.entity.js';
import { UomConversionNotFoundError } from '../../../domain/errors/uom-conversion.errors.js';
import type { UomConversionRepository } from '../../../domain/repositories/uom-conversion.repository.js';

export class UpdateUomConversionUseCase {
  constructor(private readonly repo: UomConversionRepository) {}

  async execute(id: string, data: UpdateUomConversionData): Promise<UomConversion> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new UomConversionNotFoundError(id);
    }
    return this.repo.update(id, data);
  }
}
```

- [ ] **3.8** Create `borderworxWMS/src/application/use-cases/uom-conversion/delete-uom-conversion.use-case.ts`:

```typescript
import { UomConversionNotFoundError } from '../../../domain/errors/uom-conversion.errors.js';
import type { UomConversionRepository } from '../../../domain/repositories/uom-conversion.repository.js';

export class DeleteUomConversionUseCase {
  constructor(private readonly repo: UomConversionRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new UomConversionNotFoundError(id);
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **3.9** Create `borderworxWMS/src/infrastructure/repositories/uom-conversion.mapper.ts`:

```typescript
import type { UomConversion as PrismaUomConversion, UnitOfMeasure as PrismaUom } from '@prisma/client';
import type { UomConversion } from '../../domain/entities/uom-conversion.entity.js';

type PrismaUomConversionWithUoms = PrismaUomConversion & {
  fromUom: Pick<PrismaUom, 'code' | 'name'>;
  toUom: Pick<PrismaUom, 'code' | 'name'>;
};

export class UomConversionMapper {
  static toDomain(r: PrismaUomConversionWithUoms): UomConversion {
    return {
      id: r.id,
      fromUomId: r.fromUomId,
      toUomId: r.toUomId,
      fromUomCode: r.fromUom.code,
      fromUomName: r.fromUom.name,
      toUomCode: r.toUom.code,
      toUomName: r.toUom.name,
      conversionFactor: r.conversionFactor,
      hierarchyLevel: r.hierarchyLevel,
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  }

  static toDomainList(rs: PrismaUomConversionWithUoms[]): UomConversion[] {
    return rs.map(UomConversionMapper.toDomain);
  }
}
```

- [ ] **3.10** Create `borderworxWMS/src/infrastructure/repositories/prisma-uom-conversion.repository.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import type { CreateUomConversionData, UomConversion, UpdateUomConversionData } from '../../domain/entities/uom-conversion.entity.js';
import type { UomConversionRepository } from '../../domain/repositories/uom-conversion.repository.js';
import { UomConversionMapper } from './uom-conversion.mapper.js';

const uomSelect = { select: { code: true, name: true } } as const;

export class PrismaUomConversionRepository implements UomConversionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(fromUomId?: string): Promise<UomConversion[]> {
    const records = await this.prisma.uomConversion.findMany({
      where: fromUomId ? { fromUomId } : undefined,
      include: { fromUom: uomSelect, toUom: uomSelect },
      orderBy: { createdAt: 'desc' },
    });
    return UomConversionMapper.toDomainList(records);
  }

  async findById(id: string): Promise<UomConversion | null> {
    const r = await this.prisma.uomConversion.findUnique({
      where: { id },
      include: { fromUom: uomSelect, toUom: uomSelect },
    });
    return r ? UomConversionMapper.toDomain(r) : null;
  }

  async findByPair(fromUomId: string, toUomId: string): Promise<UomConversion | null> {
    const r = await this.prisma.uomConversion.findUnique({
      where: { fromUomId_toUomId: { fromUomId, toUomId } },
      include: { fromUom: uomSelect, toUom: uomSelect },
    });
    return r ? UomConversionMapper.toDomain(r) : null;
  }

  async create(data: CreateUomConversionData): Promise<UomConversion> {
    const r = await this.prisma.uomConversion.create({
      data: {
        fromUomId: data.fromUomId,
        toUomId: data.toUomId,
        conversionFactor: data.conversionFactor,
        hierarchyLevel: data.hierarchyLevel ?? 0,
        isActive: data.isActive ?? true,
      },
      include: { fromUom: uomSelect, toUom: uomSelect },
    });
    return UomConversionMapper.toDomain(r);
  }

  async update(id: string, data: UpdateUomConversionData): Promise<UomConversion> {
    const r = await this.prisma.uomConversion.update({
      where: { id },
      data: {
        ...(data.conversionFactor !== undefined && { conversionFactor: data.conversionFactor }),
        ...(data.hierarchyLevel !== undefined && { hierarchyLevel: data.hierarchyLevel }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: { fromUom: uomSelect, toUom: uomSelect },
    });
    return UomConversionMapper.toDomain(r);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.uomConversion.delete({ where: { id } });
  }
}
```

- [ ] **3.11** Create `borderworxWMS/src/interfaces/http/controllers/uom-conversion.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import type { CreateUomConversionUseCase } from '../../../application/use-cases/uom-conversion/create-uom-conversion.use-case.js';
import type { ListUomConversionUseCase } from '../../../application/use-cases/uom-conversion/list-uom-conversion.use-case.js';
import type { UpdateUomConversionUseCase } from '../../../application/use-cases/uom-conversion/update-uom-conversion.use-case.js';
import type { DeleteUomConversionUseCase } from '../../../application/use-cases/uom-conversion/delete-uom-conversion.use-case.js';
import type { UomConversion } from '../../../domain/entities/uom-conversion.entity.js';
import type { CreateUomConversionDto, UpdateUomConversionDto, UomConversionResponseDto } from '../../../application/dto/uom-conversion.dto.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../../shared/utils/response.js';

function toConversionResponse(c: UomConversion): UomConversionResponseDto {
  return {
    id: c.id,
    fromUomId: c.fromUomId,
    toUomId: c.toUomId,
    fromUomCode: c.fromUomCode,
    fromUomName: c.fromUomName,
    toUomCode: c.toUomCode,
    toUomName: c.toUomName,
    conversionFactor: c.conversionFactor,
    hierarchyLevel: c.hierarchyLevel,
    isActive: c.isActive,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export class UomConversionController {
  constructor(
    private readonly createUseCase: CreateUomConversionUseCase,
    private readonly listUseCase: ListUomConversionUseCase,
    private readonly updateUseCase: UpdateUomConversionUseCase,
    private readonly deleteUseCase: DeleteUomConversionUseCase,
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateUomConversionDto;
    const result = await this.createUseCase.execute(body);
    sendCreated(res, toConversionResponse(result));
  }

  async list(req: Request, res: Response): Promise<void> {
    const { fromUomId } = req.query as { fromUomId?: string };
    const results = await this.listUseCase.execute(fromUomId);
    sendSuccess(res, results.map(toConversionResponse));
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateUomConversionDto;
    const result = await this.updateUseCase.execute(id, body);
    sendSuccess(res, toConversionResponse(result));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    await this.deleteUseCase.execute(id);
    sendNoContent(res);
  }
}
```

- [ ] **3.12** Create `borderworxWMS/src/interfaces/http/routes/uom-conversion.routes.ts`:

```typescript
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import { createUomConversionSchema, updateUomConversionSchema, uomConversionIdParamSchema } from '../../../application/dto/uom-conversion.dto.js';
import type { UomConversionController } from '../controllers/uom-conversion.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { validate } from '../middlewares/validate.middleware.js';

export function createUomConversionRoutes(controller: UomConversionController, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    validate({ body: createUomConversionSchema }),
    asyncHandler(async (req, res) => { await controller.create(req, res); }),
  );

  router.get(
    '/',
    authMiddleware,
    validate({ query: z.object({ fromUomId: z.string().uuid().optional() }) }),
    asyncHandler(async (req, res) => { await controller.list(req, res); }),
  );

  router.patch(
    '/:id',
    authMiddleware,
    validate({ params: uomConversionIdParamSchema, body: updateUomConversionSchema }),
    asyncHandler(async (req, res) => { await controller.update(req, res); }),
  );

  router.delete(
    '/:id',
    authMiddleware,
    validate({ params: uomConversionIdParamSchema }),
    asyncHandler(async (req, res) => { await controller.delete(req, res); }),
  );

  return router;
}
```

- [ ] **3.13** Create `borderworxWMS/tests/unit/use-cases/create-uom-conversion.use-case.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CreateUomConversionUseCase } from '../../../src/application/use-cases/uom-conversion/create-uom-conversion.use-case.js';
import type { UomConversion } from '../../../src/domain/entities/uom-conversion.entity.js';
import { UomConversionPairAlreadyExistsError } from '../../../src/domain/errors/uom-conversion.errors.js';
import type { UomConversionRepository } from '../../../src/domain/repositories/uom-conversion.repository.js';

describe('CreateUomConversionUseCase', () => {
  let useCase: CreateUomConversionUseCase;
  let mockRepo: UomConversionRepository;

  const mockConversion: UomConversion = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    fromUomId: 'aaa-111',
    toUomId: 'bbb-222',
    fromUomCode: 'EACH',
    fromUomName: 'Each',
    toUomCode: 'CASE',
    toUomName: 'Case',
    conversionFactor: 12,
    hierarchyLevel: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByPair: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    useCase = new CreateUomConversionUseCase(mockRepo);
  });

  it('should create a conversion when pair does not exist', async () => {
    vi.mocked(mockRepo.findByPair).mockResolvedValue(null);
    vi.mocked(mockRepo.create).mockResolvedValue(mockConversion);

    const result = await useCase.execute({ fromUomId: 'aaa-111', toUomId: 'bbb-222', conversionFactor: 12 });

    expect(mockRepo.findByPair).toHaveBeenCalledWith('aaa-111', 'bbb-222');
    expect(mockRepo.create).toHaveBeenCalled();
    expect(result).toEqual(mockConversion);
  });

  it('should throw UomConversionPairAlreadyExistsError when pair exists', async () => {
    vi.mocked(mockRepo.findByPair).mockResolvedValue(mockConversion);

    await expect(
      useCase.execute({ fromUomId: 'aaa-111', toUomId: 'bbb-222', conversionFactor: 12 }),
    ).rejects.toThrow(UomConversionPairAlreadyExistsError);
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **3.14** Commit:
```bash
git add borderworxWMS/src/domain/entities/uom-conversion.entity.ts \
  borderworxWMS/src/domain/repositories/uom-conversion.repository.ts \
  borderworxWMS/src/domain/errors/uom-conversion.errors.ts \
  borderworxWMS/src/application/dto/uom-conversion.dto.ts \
  borderworxWMS/src/application/use-cases/uom-conversion/ \
  borderworxWMS/src/infrastructure/repositories/uom-conversion.mapper.ts \
  borderworxWMS/src/infrastructure/repositories/prisma-uom-conversion.repository.ts \
  borderworxWMS/src/interfaces/http/controllers/uom-conversion.controller.ts \
  borderworxWMS/src/interfaces/http/routes/uom-conversion.routes.ts \
  borderworxWMS/tests/unit/use-cases/create-uom-conversion.use-case.test.ts
git commit -m "feat: add UomConversion backend stack (domain → infra → interfaces)"
```

---

## Task 4: EquivalencyGroup Backend Stack

- [ ] **4.1** Create `borderworxWMS/src/domain/entities/equivalency-group.entity.ts`:

```typescript
export type EquivalencyGroupType = 'WEIGHT' | 'VOLUME' | 'COUNT' | 'LENGTH' | 'AREA';

export interface EquivalencyGroupMember {
  id: string;
  uomId: string;
  uomCode: string;
  uomName: string;
  isPrimary: boolean;
}

export interface EquivalencyGroup {
  id: string;
  name: string;
  description: string | null;
  groupType: EquivalencyGroupType;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  members: EquivalencyGroupMember[];
}

export interface CreateEquivalencyGroupData {
  name: string;
  description?: string | null;
  groupType: EquivalencyGroupType;
  isActive?: boolean;
}

export interface UpdateEquivalencyGroupData {
  name?: string;
  description?: string | null;
  groupType?: EquivalencyGroupType;
  isActive?: boolean;
}
```

- [ ] **4.2** Create `borderworxWMS/src/domain/repositories/equivalency-group.repository.ts`:

```typescript
import type { CreateEquivalencyGroupData, EquivalencyGroup, EquivalencyGroupMember, UpdateEquivalencyGroupData } from '../entities/equivalency-group.entity.js';

export interface EquivalencyGroupRepository {
  findAll(): Promise<EquivalencyGroup[]>;
  findById(id: string): Promise<EquivalencyGroup | null>;
  create(data: CreateEquivalencyGroupData): Promise<EquivalencyGroup>;
  update(id: string, data: UpdateEquivalencyGroupData): Promise<EquivalencyGroup>;
  delete(id: string): Promise<void>;
  addMember(groupId: string, uomId: string, isPrimary: boolean): Promise<EquivalencyGroup>;
  removeMember(groupId: string, uomId: string): Promise<EquivalencyGroup>;
  findMember(groupId: string, uomId: string): Promise<EquivalencyGroupMember | null>;
}
```

- [ ] **4.3** Create `borderworxWMS/src/domain/errors/equivalency-group.errors.ts`:

```typescript
import { NotFoundError, ConflictError } from '../../shared/errors/app-error.js';

export class EquivalencyGroupNotFoundError extends NotFoundError {
  constructor(id: string) {
    super(`Equivalency group not found: ${id}`);
  }
}

export class EquivalencyGroupMemberAlreadyExistsError extends ConflictError {
  constructor(groupId: string, uomId: string) {
    super(`UOM '${uomId}' is already a member of equivalency group '${groupId}'`);
  }
}

export class EquivalencyGroupMemberNotFoundError extends NotFoundError {
  constructor(groupId: string, uomId: string) {
    super(`UOM '${uomId}' is not a member of equivalency group '${groupId}'`);
  }
}
```

- [ ] **4.4** Create `borderworxWMS/src/application/dto/equivalency-group.dto.ts`:

```typescript
import { z } from 'zod';

const groupTypeSchema = z.enum(['WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'AREA']);

export const createEquivalencyGroupSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  groupType: groupTypeSchema,
  isActive: z.boolean().optional(),
});

export const updateEquivalencyGroupSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    groupType: groupTypeSchema.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: 'At least one field required',
  });

export const equivalencyGroupIdParamSchema = z.object({ id: z.string().uuid() });

export const addMemberSchema = z.object({
  uomId: z.string().uuid(),
  isPrimary: z.boolean().optional().default(false),
});

export const removeMemberParamSchema = z.object({
  id: z.string().uuid(),
  uomId: z.string().uuid(),
});

export type CreateEquivalencyGroupDto = z.infer<typeof createEquivalencyGroupSchema>;
export type UpdateEquivalencyGroupDto = z.infer<typeof updateEquivalencyGroupSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;

export interface EquivalencyGroupMemberResponseDto {
  id: string;
  uomId: string;
  uomCode: string;
  uomName: string;
  isPrimary: boolean;
}

export interface EquivalencyGroupResponseDto {
  id: string;
  name: string;
  description: string | null;
  groupType: 'WEIGHT' | 'VOLUME' | 'COUNT' | 'LENGTH' | 'AREA';
  isActive: boolean;
  members: EquivalencyGroupMemberResponseDto[];
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **4.5** Create `borderworxWMS/src/application/use-cases/equivalency-group/create-equivalency-group.use-case.ts`:

```typescript
import type { EquivalencyGroup, CreateEquivalencyGroupData } from '../../../domain/entities/equivalency-group.entity.js';
import type { EquivalencyGroupRepository } from '../../../domain/repositories/equivalency-group.repository.js';

export class CreateEquivalencyGroupUseCase {
  constructor(private readonly repo: EquivalencyGroupRepository) {}

  async execute(data: CreateEquivalencyGroupData): Promise<EquivalencyGroup> {
    return this.repo.create(data);
  }
}
```

- [ ] **4.6** Create `borderworxWMS/src/application/use-cases/equivalency-group/list-equivalency-group.use-case.ts`:

```typescript
import type { EquivalencyGroup } from '../../../domain/entities/equivalency-group.entity.js';
import type { EquivalencyGroupRepository } from '../../../domain/repositories/equivalency-group.repository.js';

export class ListEquivalencyGroupUseCase {
  constructor(private readonly repo: EquivalencyGroupRepository) {}

  async execute(): Promise<EquivalencyGroup[]> {
    return this.repo.findAll();
  }
}
```

- [ ] **4.7** Create `borderworxWMS/src/application/use-cases/equivalency-group/update-equivalency-group.use-case.ts`:

```typescript
import type { EquivalencyGroup, UpdateEquivalencyGroupData } from '../../../domain/entities/equivalency-group.entity.js';
import { EquivalencyGroupNotFoundError } from '../../../domain/errors/equivalency-group.errors.js';
import type { EquivalencyGroupRepository } from '../../../domain/repositories/equivalency-group.repository.js';

export class UpdateEquivalencyGroupUseCase {
  constructor(private readonly repo: EquivalencyGroupRepository) {}

  async execute(id: string, data: UpdateEquivalencyGroupData): Promise<EquivalencyGroup> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new EquivalencyGroupNotFoundError(id);
    }
    return this.repo.update(id, data);
  }
}
```

- [ ] **4.8** Create `borderworxWMS/src/application/use-cases/equivalency-group/delete-equivalency-group.use-case.ts`:

```typescript
import { EquivalencyGroupNotFoundError } from '../../../domain/errors/equivalency-group.errors.js';
import type { EquivalencyGroupRepository } from '../../../domain/repositories/equivalency-group.repository.js';

export class DeleteEquivalencyGroupUseCase {
  constructor(private readonly repo: EquivalencyGroupRepository) {}

  async execute(id: string): Promise<void> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new EquivalencyGroupNotFoundError(id);
    }
    await this.repo.delete(id);
  }
}
```

- [ ] **4.9** Create `borderworxWMS/src/application/use-cases/equivalency-group/add-equivalency-group-member.use-case.ts`:

```typescript
import type { EquivalencyGroup } from '../../../domain/entities/equivalency-group.entity.js';
import { EquivalencyGroupNotFoundError, EquivalencyGroupMemberAlreadyExistsError } from '../../../domain/errors/equivalency-group.errors.js';
import type { EquivalencyGroupRepository } from '../../../domain/repositories/equivalency-group.repository.js';

export class AddEquivalencyGroupMemberUseCase {
  constructor(private readonly repo: EquivalencyGroupRepository) {}

  async execute(groupId: string, uomId: string, isPrimary: boolean): Promise<EquivalencyGroup> {
    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new EquivalencyGroupNotFoundError(groupId);
    }
    const existingMember = await this.repo.findMember(groupId, uomId);
    if (existingMember) {
      throw new EquivalencyGroupMemberAlreadyExistsError(groupId, uomId);
    }
    return this.repo.addMember(groupId, uomId, isPrimary);
  }
}
```

- [ ] **4.10** Create `borderworxWMS/src/application/use-cases/equivalency-group/remove-equivalency-group-member.use-case.ts`:

```typescript
import type { EquivalencyGroup } from '../../../domain/entities/equivalency-group.entity.js';
import { EquivalencyGroupNotFoundError, EquivalencyGroupMemberNotFoundError } from '../../../domain/errors/equivalency-group.errors.js';
import type { EquivalencyGroupRepository } from '../../../domain/repositories/equivalency-group.repository.js';

export class RemoveEquivalencyGroupMemberUseCase {
  constructor(private readonly repo: EquivalencyGroupRepository) {}

  async execute(groupId: string, uomId: string): Promise<EquivalencyGroup> {
    const group = await this.repo.findById(groupId);
    if (!group) {
      throw new EquivalencyGroupNotFoundError(groupId);
    }
    const member = await this.repo.findMember(groupId, uomId);
    if (!member) {
      throw new EquivalencyGroupMemberNotFoundError(groupId, uomId);
    }
    return this.repo.removeMember(groupId, uomId);
  }
}
```

- [ ] **4.11** Create `borderworxWMS/src/infrastructure/repositories/equivalency-group.mapper.ts`:

```typescript
import type {
  EquivalencyGroup as PrismaGroup,
  EquivalencyGroupMember as PrismaMember,
  UnitOfMeasure as PrismaUom,
} from '@prisma/client';
import type { EquivalencyGroup } from '../../domain/entities/equivalency-group.entity.js';

type PrismaMemberWithUom = PrismaMember & {
  uom: Pick<PrismaUom, 'code' | 'name'>;
};

type PrismaGroupWithMembers = PrismaGroup & {
  members: PrismaMemberWithUom[];
};

export class EquivalencyGroupMapper {
  static toDomain(r: PrismaGroupWithMembers): EquivalencyGroup {
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      groupType: r.groupType as EquivalencyGroup['groupType'],
      isActive: r.isActive,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      members: r.members.map((m) => ({
        id: m.id,
        uomId: m.uomId,
        uomCode: m.uom.code,
        uomName: m.uom.name,
        isPrimary: m.isPrimary,
      })),
    };
  }

  static toDomainList(rs: PrismaGroupWithMembers[]): EquivalencyGroup[] {
    return rs.map(EquivalencyGroupMapper.toDomain);
  }
}
```

- [ ] **4.12** Create `borderworxWMS/src/infrastructure/repositories/prisma-equivalency-group.repository.ts`:

```typescript
import type { PrismaClient } from '@prisma/client';
import type { CreateEquivalencyGroupData, EquivalencyGroup, EquivalencyGroupMember, UpdateEquivalencyGroupData } from '../../domain/entities/equivalency-group.entity.js';
import type { EquivalencyGroupRepository } from '../../domain/repositories/equivalency-group.repository.js';
import { EquivalencyGroupMapper } from './equivalency-group.mapper.js';

const membersInclude = {
  members: {
    include: { uom: { select: { code: true, name: true } } },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

export class PrismaEquivalencyGroupRepository implements EquivalencyGroupRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(): Promise<EquivalencyGroup[]> {
    const records = await this.prisma.equivalencyGroup.findMany({
      include: membersInclude,
      orderBy: { name: 'asc' },
    });
    return EquivalencyGroupMapper.toDomainList(records);
  }

  async findById(id: string): Promise<EquivalencyGroup | null> {
    const r = await this.prisma.equivalencyGroup.findUnique({
      where: { id },
      include: membersInclude,
    });
    return r ? EquivalencyGroupMapper.toDomain(r) : null;
  }

  async create(data: CreateEquivalencyGroupData): Promise<EquivalencyGroup> {
    const r = await this.prisma.equivalencyGroup.create({
      data: {
        name: data.name,
        description: data.description ?? null,
        groupType: data.groupType,
        isActive: data.isActive ?? true,
      },
      include: membersInclude,
    });
    return EquivalencyGroupMapper.toDomain(r);
  }

  async update(id: string, data: UpdateEquivalencyGroupData): Promise<EquivalencyGroup> {
    const r = await this.prisma.equivalencyGroup.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.groupType !== undefined && { groupType: data.groupType }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: membersInclude,
    });
    return EquivalencyGroupMapper.toDomain(r);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.equivalencyGroup.delete({ where: { id } });
  }

  async addMember(groupId: string, uomId: string, isPrimary: boolean): Promise<EquivalencyGroup> {
    await this.prisma.equivalencyGroupMember.create({
      data: { groupId, uomId, isPrimary },
    });
    const r = await this.prisma.equivalencyGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: membersInclude,
    });
    return EquivalencyGroupMapper.toDomain(r);
  }

  async removeMember(groupId: string, uomId: string): Promise<EquivalencyGroup> {
    await this.prisma.equivalencyGroupMember.deleteMany({
      where: { groupId, uomId },
    });
    const r = await this.prisma.equivalencyGroup.findUniqueOrThrow({
      where: { id: groupId },
      include: membersInclude,
    });
    return EquivalencyGroupMapper.toDomain(r);
  }

  async findMember(groupId: string, uomId: string): Promise<EquivalencyGroupMember | null> {
    const r = await this.prisma.equivalencyGroupMember.findUnique({
      where: { groupId_uomId: { groupId, uomId } },
      include: { uom: { select: { code: true, name: true } } },
    });
    if (!r) return null;
    return {
      id: r.id,
      uomId: r.uomId,
      uomCode: r.uom.code,
      uomName: r.uom.name,
      isPrimary: r.isPrimary,
    };
  }
}
```

- [ ] **4.13** Create `borderworxWMS/src/interfaces/http/controllers/equivalency-group.controller.ts`:

```typescript
import type { Request, Response } from 'express';
import type { CreateEquivalencyGroupUseCase } from '../../../application/use-cases/equivalency-group/create-equivalency-group.use-case.js';
import type { ListEquivalencyGroupUseCase } from '../../../application/use-cases/equivalency-group/list-equivalency-group.use-case.js';
import type { UpdateEquivalencyGroupUseCase } from '../../../application/use-cases/equivalency-group/update-equivalency-group.use-case.js';
import type { DeleteEquivalencyGroupUseCase } from '../../../application/use-cases/equivalency-group/delete-equivalency-group.use-case.js';
import type { AddEquivalencyGroupMemberUseCase } from '../../../application/use-cases/equivalency-group/add-equivalency-group-member.use-case.js';
import type { RemoveEquivalencyGroupMemberUseCase } from '../../../application/use-cases/equivalency-group/remove-equivalency-group-member.use-case.js';
import type { EquivalencyGroup } from '../../../domain/entities/equivalency-group.entity.js';
import type { CreateEquivalencyGroupDto, UpdateEquivalencyGroupDto, AddMemberDto, EquivalencyGroupResponseDto } from '../../../application/dto/equivalency-group.dto.js';
import { sendCreated, sendNoContent, sendSuccess } from '../../../shared/utils/response.js';

function toGroupResponse(g: EquivalencyGroup): EquivalencyGroupResponseDto {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    groupType: g.groupType,
    isActive: g.isActive,
    members: g.members.map((m) => ({
      id: m.id,
      uomId: m.uomId,
      uomCode: m.uomCode,
      uomName: m.uomName,
      isPrimary: m.isPrimary,
    })),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

export class EquivalencyGroupController {
  constructor(
    private readonly createUseCase: CreateEquivalencyGroupUseCase,
    private readonly listUseCase: ListEquivalencyGroupUseCase,
    private readonly updateUseCase: UpdateEquivalencyGroupUseCase,
    private readonly deleteUseCase: DeleteEquivalencyGroupUseCase,
    private readonly addMemberUseCase: AddEquivalencyGroupMemberUseCase,
    private readonly removeMemberUseCase: RemoveEquivalencyGroupMemberUseCase,
  ) {}

  async create(req: Request, res: Response): Promise<void> {
    const body = req.body as CreateEquivalencyGroupDto;
    const group = await this.createUseCase.execute(body);
    sendCreated(res, toGroupResponse(group));
  }

  async list(req: Request, res: Response): Promise<void> {
    const groups = await this.listUseCase.execute();
    sendSuccess(res, groups.map(toGroupResponse));
  }

  async update(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    const body = req.body as UpdateEquivalencyGroupDto;
    const group = await this.updateUseCase.execute(id, body);
    sendSuccess(res, toGroupResponse(group));
  }

  async delete(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    await this.deleteUseCase.execute(id);
    sendNoContent(res);
  }

  async addMember(req: Request, res: Response): Promise<void> {
    const { id } = req.params as { id: string };
    const body = req.body as AddMemberDto;
    const group = await this.addMemberUseCase.execute(id, body.uomId, body.isPrimary);
    sendSuccess(res, toGroupResponse(group));
  }

  async removeMember(req: Request, res: Response): Promise<void> {
    const { id, uomId } = req.params as { id: string; uomId: string };
    const group = await this.removeMemberUseCase.execute(id, uomId);
    sendSuccess(res, toGroupResponse(group));
  }
}
```

- [ ] **4.14** Create `borderworxWMS/src/interfaces/http/routes/equivalency-group.routes.ts`:

```typescript
import type { RequestHandler } from 'express';
import { Router } from 'express';
import { z } from 'zod';
import {
  createEquivalencyGroupSchema,
  updateEquivalencyGroupSchema,
  equivalencyGroupIdParamSchema,
  addMemberSchema,
  removeMemberParamSchema,
} from '../../../application/dto/equivalency-group.dto.js';
import type { EquivalencyGroupController } from '../controllers/equivalency-group.controller.js';
import { asyncHandler } from '../middlewares/async-handler.js';
import { validate } from '../middlewares/validate.middleware.js';

export function createEquivalencyGroupRoutes(controller: EquivalencyGroupController, authMiddleware: RequestHandler): Router {
  const router = Router();

  router.post(
    '/',
    authMiddleware,
    validate({ body: createEquivalencyGroupSchema }),
    asyncHandler(async (req, res) => { await controller.create(req, res); }),
  );

  router.get(
    '/',
    authMiddleware,
    asyncHandler(async (req, res) => { await controller.list(req, res); }),
  );

  router.patch(
    '/:id',
    authMiddleware,
    validate({ params: equivalencyGroupIdParamSchema, body: updateEquivalencyGroupSchema }),
    asyncHandler(async (req, res) => { await controller.update(req, res); }),
  );

  router.delete(
    '/:id',
    authMiddleware,
    validate({ params: equivalencyGroupIdParamSchema }),
    asyncHandler(async (req, res) => { await controller.delete(req, res); }),
  );

  router.post(
    '/:id/members',
    authMiddleware,
    validate({ params: equivalencyGroupIdParamSchema, body: addMemberSchema }),
    asyncHandler(async (req, res) => { await controller.addMember(req, res); }),
  );

  router.delete(
    '/:id/members/:uomId',
    authMiddleware,
    validate({ params: removeMemberParamSchema }),
    asyncHandler(async (req, res) => { await controller.removeMember(req, res); }),
  );

  return router;
}
```

- [ ] **4.15** Commit:
```bash
git add borderworxWMS/src/domain/entities/equivalency-group.entity.ts \
  borderworxWMS/src/domain/repositories/equivalency-group.repository.ts \
  borderworxWMS/src/domain/errors/equivalency-group.errors.ts \
  borderworxWMS/src/application/dto/equivalency-group.dto.ts \
  borderworxWMS/src/application/use-cases/equivalency-group/ \
  borderworxWMS/src/infrastructure/repositories/equivalency-group.mapper.ts \
  borderworxWMS/src/infrastructure/repositories/prisma-equivalency-group.repository.ts \
  borderworxWMS/src/interfaces/http/controllers/equivalency-group.controller.ts \
  borderworxWMS/src/interfaces/http/routes/equivalency-group.routes.ts
git commit -m "feat: add EquivalencyGroup backend stack (domain → infra → interfaces)"
```

---

## Task 5: Item Entity + DTO + Use Case + Mapper Updates

- [ ] **5.1** Edit `borderworxWMS/src/domain/entities/item.entity.ts`. Replace `unitOfMeasure: string;` in the `Item` interface with:

```typescript
  unitOfMeasureId: string | null;
  unitOfMeasure: { id: string; code: string; name: string } | null;
```

In `CreateItemData`, replace `unitOfMeasure?: string | undefined;` with:

```typescript
  unitOfMeasureId?: string | null | undefined;
```

In `UpdateItemData`, replace `unitOfMeasure?: string | undefined;` with:

```typescript
  unitOfMeasureId?: string | null | undefined;
```

- [ ] **5.2** Edit `borderworxWMS/src/infrastructure/repositories/item.mapper.ts`. Replace the import line and the entire `toDomain` method body:

```typescript
import type { Item as PrismaItem, UnitOfMeasure as PrismaUom } from '@prisma/client';

import type { Item } from '../../domain/entities/item.entity.js';

type PrismaItemWithUom = PrismaItem & {
  unitOfMeasure: Pick<PrismaUom, 'id' | 'code' | 'name'> | null;
};

export class ItemMapper {
  static toDomain(prismaItem: PrismaItemWithUom): Item {
    return {
      id: prismaItem.id,
      sku: prismaItem.sku,
      name: prismaItem.name,
      description: prismaItem.description,
      category: prismaItem.category,
      classification: prismaItem.classification,
      customerId: prismaItem.customerId,
      imageUrl: prismaItem.imageUrl,
      unitOfMeasureId: prismaItem.unitOfMeasureId,
      unitOfMeasure: prismaItem.unitOfMeasure
        ? { id: prismaItem.unitOfMeasure.id, code: prismaItem.unitOfMeasure.code, name: prismaItem.unitOfMeasure.name }
        : null,
      secondaryUom: prismaItem.secondaryUom,
      weight: prismaItem.weight,
      length: prismaItem.length,
      width: prismaItem.width,
      height: prismaItem.height,
      cost: prismaItem.cost,
      price: prismaItem.price,
      valuationMethod: prismaItem.valuationMethod as Item['valuationMethod'],
      minimumStock: prismaItem.minimumStock,
      maximumStock: prismaItem.maximumStock,
      reorderPoint: prismaItem.reorderPoint,
      minStorageTemp: prismaItem.minStorageTemp,
      cycleCountInterval: prismaItem.cycleCountInterval,
      receiveToHoldLocation: prismaItem.receiveToHoldLocation,
      serialTracking: prismaItem.serialTracking,
      lotTracking: prismaItem.lotTracking,
      expiryTracking: prismaItem.expiryTracking,
      costTracking: prismaItem.costTracking,
      pickScanRequired: prismaItem.pickScanRequired,
      countryOfOrigin: prismaItem.countryOfOrigin,
      nmfc: prismaItem.nmfc,
      nmfcClass: prismaItem.nmfcClass,
      nmfcDescription: prismaItem.nmfcDescription,
      tariffCode: prismaItem.tariffCode,
      isActive: prismaItem.isActive,
      isKit: prismaItem.isKit,
      createdAt: prismaItem.createdAt,
      updatedAt: prismaItem.updatedAt,
    };
  }

  static toDomainList(prismaItems: PrismaItemWithUom[]): Item[] {
    return prismaItems.map(ItemMapper.toDomain);
  }
}
```

- [ ] **5.3** Edit `borderworxWMS/src/infrastructure/repositories/prisma-item.repository.ts`. Add `include` to `findById` and `findAll`, and update `create`/`update` to use `unitOfMeasureId`. The complete updated file:

```typescript
import type { PrismaClient } from '@prisma/client';

import type { CreateItemData, Item, UpdateItemData } from '../../domain/entities/item.entity.js';
import type { FindAllItemOptions, ItemRepository } from '../../domain/repositories/item.repository.js';
import { ItemMapper } from './item.mapper.js';

const uomInclude = {
  unitOfMeasure: { select: { id: true, code: true, name: true } },
} as const;

function buildSearchWhere(search: string | undefined) {
  if (!search) return {};
  return {
    OR: [
      { sku: { contains: search, mode: 'insensitive' as const } },
      { name: { contains: search, mode: 'insensitive' as const } },
    ],
  };
}

export class PrismaItemRepository implements ItemRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Item | null> {
    const record = await this.prisma.item.findUnique({ where: { id }, include: uomInclude });
    return record ? ItemMapper.toDomain(record) : null;
  }

  async findAll(options?: FindAllItemOptions): Promise<Item[]> {
    const where = buildSearchWhere(options?.search);
    const records = await this.prisma.item.findMany({
      where,
      include: uomInclude,
      ...(options?.skip !== undefined && { skip: options.skip }),
      ...(options?.take !== undefined && { take: options.take }),
      orderBy: { createdAt: 'desc' },
    });
    return ItemMapper.toDomainList(records);
  }

  async count(search?: string): Promise<number> {
    const where = buildSearchWhere(search);
    return this.prisma.item.count({ where });
  }

  async create(data: CreateItemData): Promise<Item> {
    const record = await this.prisma.item.create({
      data: {
        sku: data.sku,
        name: data.name,
        description: data.description ?? null,
        category: data.category ?? null,
        classification: data.classification ?? null,
        customerId: data.customerId ?? null,
        imageUrl: data.imageUrl ?? null,
        unitOfMeasureId: data.unitOfMeasureId ?? null,
        secondaryUom: data.secondaryUom ?? null,
        weight: data.weight ?? null,
        length: data.length ?? null,
        width: data.width ?? null,
        height: data.height ?? null,
        cost: data.cost ?? null,
        price: data.price ?? null,
        valuationMethod: data.valuationMethod ?? null,
        minimumStock: data.minimumStock ?? 0,
        maximumStock: data.maximumStock ?? null,
        reorderPoint: data.reorderPoint ?? null,
        minStorageTemp: data.minStorageTemp ?? null,
        cycleCountInterval: data.cycleCountInterval ?? null,
        receiveToHoldLocation: data.receiveToHoldLocation ?? false,
        serialTracking: data.serialTracking ?? false,
        lotTracking: data.lotTracking ?? false,
        expiryTracking: data.expiryTracking ?? false,
        costTracking: data.costTracking ?? false,
        pickScanRequired: data.pickScanRequired ?? false,
        countryOfOrigin: data.countryOfOrigin ?? null,
        nmfc: data.nmfc ?? null,
        nmfcClass: data.nmfcClass ?? null,
        nmfcDescription: data.nmfcDescription ?? null,
        tariffCode: data.tariffCode ?? null,
      },
      include: uomInclude,
    });
    return ItemMapper.toDomain(record);
  }

  async update(id: string, data: UpdateItemData): Promise<Item> {
    const record = await this.prisma.item.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.category !== undefined && { category: data.category }),
        ...(data.classification !== undefined && { classification: data.classification }),
        ...(data.customerId !== undefined && { customerId: data.customerId }),
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.unitOfMeasureId !== undefined && { unitOfMeasureId: data.unitOfMeasureId }),
        ...(data.secondaryUom !== undefined && { secondaryUom: data.secondaryUom }),
        ...(data.weight !== undefined && { weight: data.weight }),
        ...(data.length !== undefined && { length: data.length }),
        ...(data.width !== undefined && { width: data.width }),
        ...(data.height !== undefined && { height: data.height }),
        ...(data.cost !== undefined && { cost: data.cost }),
        ...(data.price !== undefined && { price: data.price }),
        ...(data.valuationMethod !== undefined && { valuationMethod: data.valuationMethod }),
        ...(data.minimumStock !== undefined && { minimumStock: data.minimumStock }),
        ...(data.maximumStock !== undefined && { maximumStock: data.maximumStock }),
        ...(data.reorderPoint !== undefined && { reorderPoint: data.reorderPoint }),
        ...(data.minStorageTemp !== undefined && { minStorageTemp: data.minStorageTemp }),
        ...(data.cycleCountInterval !== undefined && { cycleCountInterval: data.cycleCountInterval }),
        ...(data.receiveToHoldLocation !== undefined && { receiveToHoldLocation: data.receiveToHoldLocation }),
        ...(data.serialTracking !== undefined && { serialTracking: data.serialTracking }),
        ...(data.lotTracking !== undefined && { lotTracking: data.lotTracking }),
        ...(data.expiryTracking !== undefined && { expiryTracking: data.expiryTracking }),
        ...(data.costTracking !== undefined && { costTracking: data.costTracking }),
        ...(data.pickScanRequired !== undefined && { pickScanRequired: data.pickScanRequired }),
        ...(data.countryOfOrigin !== undefined && { countryOfOrigin: data.countryOfOrigin }),
        ...(data.nmfc !== undefined && { nmfc: data.nmfc }),
        ...(data.nmfcClass !== undefined && { nmfcClass: data.nmfcClass }),
        ...(data.nmfcDescription !== undefined && { nmfcDescription: data.nmfcDescription }),
        ...(data.tariffCode !== undefined && { tariffCode: data.tariffCode }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
      include: uomInclude,
    });
    return ItemMapper.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.item.delete({ where: { id } });
  }

  async existsById(id: string): Promise<boolean> {
    const count = await this.prisma.item.count({ where: { id } });
    return count > 0;
  }
}
```

- [ ] **5.4** Edit `borderworxWMS/src/application/dto/item.dto.ts`. Replace:
```typescript
  unitOfMeasure: z.string().min(1).max(50).optional(),
```
with:
```typescript
  unitOfMeasureId: z.string().uuid().nullable().optional(),
```

Replace in `ItemResponseDto`:
```typescript
  unitOfMeasure: string;
```
with:
```typescript
  unitOfMeasureId: string | null;
  unitOfMeasure: { id: string; code: string; name: string } | null;
```

- [ ] **5.5** Edit `borderworxWMS/src/application/use-cases/item/create-item.use-case.ts` to validate the `unitOfMeasureId` if provided:

```typescript
import type { Item } from '../../../domain/entities/item.entity.js';
import type { ItemRepository } from '../../../domain/repositories/item.repository.js';
import type { UnitOfMeasureRepository } from '../../../domain/repositories/unit-of-measure.repository.js';
import { UnitOfMeasureNotFoundError } from '../../../domain/errors/unit-of-measure.errors.js';
import type { CreateItemDto } from '../../dto/item.dto.js';

export class CreateItemUseCase {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly unitOfMeasureRepository: UnitOfMeasureRepository,
  ) {}

  async execute(data: CreateItemDto): Promise<Item> {
    if (data.unitOfMeasureId) {
      const uom = await this.unitOfMeasureRepository.findById(data.unitOfMeasureId);
      if (!uom) {
        throw new UnitOfMeasureNotFoundError(data.unitOfMeasureId);
      }
    }
    return this.itemRepository.create(data);
  }
}
```

- [ ] **5.6** Edit `borderworxWMS/src/application/use-cases/item/update-item.use-case.ts` to add the same validation:

```typescript
import type { Item } from '../../../domain/entities/item.entity.js';
import { ItemNotFoundError } from '../../../domain/errors/item.errors.js';
import type { ItemRepository } from '../../../domain/repositories/item.repository.js';
import type { UnitOfMeasureRepository } from '../../../domain/repositories/unit-of-measure.repository.js';
import { UnitOfMeasureNotFoundError } from '../../../domain/errors/unit-of-measure.errors.js';
import type { UpdateItemDto } from '../../dto/item.dto.js';

export class UpdateItemUseCase {
  constructor(
    private readonly itemRepository: ItemRepository,
    private readonly unitOfMeasureRepository: UnitOfMeasureRepository,
  ) {}

  async execute(id: string, data: UpdateItemDto): Promise<Item> {
    const existing = await this.itemRepository.findById(id);
    if (!existing) {
      throw new ItemNotFoundError(id);
    }
    if (data.unitOfMeasureId) {
      const uom = await this.unitOfMeasureRepository.findById(data.unitOfMeasureId);
      if (!uom) {
        throw new UnitOfMeasureNotFoundError(data.unitOfMeasureId);
      }
    }
    return this.itemRepository.update(id, data);
  }
}
```

- [ ] **5.7** Edit `borderworxWMS/src/interfaces/http/controllers/item.controller.ts`. Update `toItemResponse` to reflect the new `unitOfMeasure` shape. Replace:
```typescript
    unitOfMeasure: item.unitOfMeasure,
```
with:
```typescript
    unitOfMeasureId: item.unitOfMeasureId,
    unitOfMeasure: item.unitOfMeasure,
```

- [ ] **5.8** Commit:
```bash
git add borderworxWMS/src/domain/entities/item.entity.ts \
  borderworxWMS/src/infrastructure/repositories/item.mapper.ts \
  borderworxWMS/src/infrastructure/repositories/prisma-item.repository.ts \
  borderworxWMS/src/application/dto/item.dto.ts \
  borderworxWMS/src/application/use-cases/item/create-item.use-case.ts \
  borderworxWMS/src/application/use-cases/item/update-item.use-case.ts \
  borderworxWMS/src/interfaces/http/controllers/item.controller.ts
git commit -m "feat: migrate Item.unitOfMeasure from string to UnitOfMeasure FK relation"
```

---

## Task 6: Container + Router Wiring

- [ ] **6.1** Edit `borderworxWMS/src/main/container.ts`. Add the following imports after the existing ItemUoM imports (around line 61):

```typescript
import { CreateUnitOfMeasureUseCase } from '../application/use-cases/unit-of-measure/create-unit-of-measure.use-case.js';
import { ListUnitOfMeasureUseCase } from '../application/use-cases/unit-of-measure/list-unit-of-measure.use-case.js';
import { UpdateUnitOfMeasureUseCase } from '../application/use-cases/unit-of-measure/update-unit-of-measure.use-case.js';
import { DeleteUnitOfMeasureUseCase } from '../application/use-cases/unit-of-measure/delete-unit-of-measure.use-case.js';
import { PrismaUnitOfMeasureRepository } from '../infrastructure/repositories/prisma-unit-of-measure.repository.js';
import { UnitOfMeasureController } from '../interfaces/http/controllers/unit-of-measure.controller.js';

import { CreateUomConversionUseCase } from '../application/use-cases/uom-conversion/create-uom-conversion.use-case.js';
import { ListUomConversionUseCase } from '../application/use-cases/uom-conversion/list-uom-conversion.use-case.js';
import { UpdateUomConversionUseCase } from '../application/use-cases/uom-conversion/update-uom-conversion.use-case.js';
import { DeleteUomConversionUseCase } from '../application/use-cases/uom-conversion/delete-uom-conversion.use-case.js';
import { PrismaUomConversionRepository } from '../infrastructure/repositories/prisma-uom-conversion.repository.js';
import { UomConversionController } from '../interfaces/http/controllers/uom-conversion.controller.js';

import { CreateEquivalencyGroupUseCase } from '../application/use-cases/equivalency-group/create-equivalency-group.use-case.js';
import { ListEquivalencyGroupUseCase } from '../application/use-cases/equivalency-group/list-equivalency-group.use-case.js';
import { UpdateEquivalencyGroupUseCase } from '../application/use-cases/equivalency-group/update-equivalency-group.use-case.js';
import { DeleteEquivalencyGroupUseCase } from '../application/use-cases/equivalency-group/delete-equivalency-group.use-case.js';
import { AddEquivalencyGroupMemberUseCase } from '../application/use-cases/equivalency-group/add-equivalency-group-member.use-case.js';
import { RemoveEquivalencyGroupMemberUseCase } from '../application/use-cases/equivalency-group/remove-equivalency-group-member.use-case.js';
import { PrismaEquivalencyGroupRepository } from '../infrastructure/repositories/prisma-equivalency-group.repository.js';
import { EquivalencyGroupController } from '../interfaces/http/controllers/equivalency-group.controller.js';
```

- [ ] **6.2** In the `// Repositories` section of `container.ts`, add after `itemUoMRepository`:

```typescript
const unitOfMeasureRepository = new PrismaUnitOfMeasureRepository(prisma);
const uomConversionRepository = new PrismaUomConversionRepository(prisma);
const equivalencyGroupRepository = new PrismaEquivalencyGroupRepository(prisma);
```

- [ ] **6.3** In the `// Item Use Cases` section of `container.ts`, update `createItemUseCase` and `updateItemUseCase` to pass `unitOfMeasureRepository` as second argument. Replace:

```typescript
const createItemUseCase = new CreateItemUseCase(itemRepository);
```
with:
```typescript
const createItemUseCase = new CreateItemUseCase(itemRepository, unitOfMeasureRepository);
```

Replace:
```typescript
const updateItemUseCase = new UpdateItemUseCase(itemRepository);
```
with:
```typescript
const updateItemUseCase = new UpdateItemUseCase(itemRepository, unitOfMeasureRepository);
```

- [ ] **6.4** Add UOM use cases in `container.ts` after the `// Item UoM Use Cases` block:

```typescript
// UnitOfMeasure Use Cases
const createUnitOfMeasureUseCase = new CreateUnitOfMeasureUseCase(unitOfMeasureRepository);
const listUnitOfMeasureUseCase = new ListUnitOfMeasureUseCase(unitOfMeasureRepository);
const updateUnitOfMeasureUseCase = new UpdateUnitOfMeasureUseCase(unitOfMeasureRepository);
const deleteUnitOfMeasureUseCase = new DeleteUnitOfMeasureUseCase(unitOfMeasureRepository);

// UomConversion Use Cases
const createUomConversionUseCase = new CreateUomConversionUseCase(uomConversionRepository);
const listUomConversionUseCase = new ListUomConversionUseCase(uomConversionRepository);
const updateUomConversionUseCase = new UpdateUomConversionUseCase(uomConversionRepository);
const deleteUomConversionUseCase = new DeleteUomConversionUseCase(uomConversionRepository);

// EquivalencyGroup Use Cases
const createEquivalencyGroupUseCase = new CreateEquivalencyGroupUseCase(equivalencyGroupRepository);
const listEquivalencyGroupUseCase = new ListEquivalencyGroupUseCase(equivalencyGroupRepository);
const updateEquivalencyGroupUseCase = new UpdateEquivalencyGroupUseCase(equivalencyGroupRepository);
const deleteEquivalencyGroupUseCase = new DeleteEquivalencyGroupUseCase(equivalencyGroupRepository);
const addEquivalencyGroupMemberUseCase = new AddEquivalencyGroupMemberUseCase(equivalencyGroupRepository);
const removeEquivalencyGroupMemberUseCase = new RemoveEquivalencyGroupMemberUseCase(equivalencyGroupRepository);
```

- [ ] **6.5** Add controllers in `container.ts` after the `itemUoMController` line:

```typescript
const unitOfMeasureController = new UnitOfMeasureController(
  createUnitOfMeasureUseCase,
  listUnitOfMeasureUseCase,
  updateUnitOfMeasureUseCase,
  deleteUnitOfMeasureUseCase,
);

const uomConversionController = new UomConversionController(
  createUomConversionUseCase,
  listUomConversionUseCase,
  updateUomConversionUseCase,
  deleteUomConversionUseCase,
);

const equivalencyGroupController = new EquivalencyGroupController(
  createEquivalencyGroupUseCase,
  listEquivalencyGroupUseCase,
  updateEquivalencyGroupUseCase,
  deleteEquivalencyGroupUseCase,
  addEquivalencyGroupMemberUseCase,
  removeEquivalencyGroupMemberUseCase,
);
```

- [ ] **6.6** In the `export const controllers: Controllers` object at the bottom of `container.ts`, add:

```typescript
  unitOfMeasureController,
  uomConversionController,
  equivalencyGroupController,
```

- [ ] **6.7** Edit `borderworxWMS/src/interfaces/http/routes/router.ts`. Add imports for the three new route factories and controller types. After the existing controller type imports, add:

```typescript
import type { UnitOfMeasureController } from '../controllers/unit-of-measure.controller.js';
import type { UomConversionController } from '../controllers/uom-conversion.controller.js';
import type { EquivalencyGroupController } from '../controllers/equivalency-group.controller.js';
```

After the existing route factory imports, add:

```typescript
import { createUnitOfMeasureRoutes } from './unit-of-measure.routes.js';
import { createUomConversionRoutes } from './uom-conversion.routes.js';
import { createEquivalencyGroupRoutes } from './equivalency-group.routes.js';
```

In the `Controllers` interface, add after `putawayTaskController`:

```typescript
  unitOfMeasureController: UnitOfMeasureController;
  uomConversionController: UomConversionController;
  equivalencyGroupController: EquivalencyGroupController;
```

In `createRouter`, add after the `/putaway` route registration:

```typescript
  router.use('/unit-of-measure', createUnitOfMeasureRoutes(controllers.unitOfMeasureController, middlewares.authMiddleware));
  router.use('/uom-conversion', createUomConversionRoutes(controllers.uomConversionController, middlewares.authMiddleware));
  router.use('/equivalency-group', createEquivalencyGroupRoutes(controllers.equivalencyGroupController, middlewares.authMiddleware));
```

- [ ] **6.8** Commit:
```bash
git add borderworxWMS/src/main/container.ts \
  borderworxWMS/src/interfaces/http/routes/router.ts
git commit -m "feat: wire UOM management controllers and routes into container and router"
```

---

## Task 7: Seed Data

- [ ] **7.1** Open `borderworxWMS/prisma/seed.ts`. After the users loop and before `console.log('Seeding completed.')`, add the following UOM upsert block:

```typescript
  const uoms = [
    { code: 'EA',   name: 'Each',         uomType: 'COUNT'  as const, isBaseUnit: true,  conversionFactor: 1.0 },
    { code: 'BOX',  name: 'Box',          uomType: 'COUNT'  as const, isBaseUnit: false, conversionFactor: 1.0 },
    { code: 'CASE', name: 'Case',         uomType: 'COUNT'  as const, isBaseUnit: false, conversionFactor: 1.0 },
    { code: 'PAL',  name: 'Pallet',       uomType: 'COUNT'  as const, isBaseUnit: false, conversionFactor: 1.0 },
    { code: 'LB',   name: 'Pound',        uomType: 'WEIGHT' as const, isBaseUnit: true,  conversionFactor: 1.0 },
    { code: 'KG',   name: 'Kilogram',     uomType: 'WEIGHT' as const, isBaseUnit: false, conversionFactor: 2.20462 },
    { code: 'G',    name: 'Gram',         uomType: 'WEIGHT' as const, isBaseUnit: false, conversionFactor: 0.00220462 },
    { code: 'OZ',   name: 'Ounce',        uomType: 'WEIGHT' as const, isBaseUnit: false, conversionFactor: 0.0625 },
    { code: 'FT',   name: 'Foot',         uomType: 'LENGTH' as const, isBaseUnit: true,  conversionFactor: 1.0 },
    { code: 'IN',   name: 'Inch',         uomType: 'LENGTH' as const, isBaseUnit: false, conversionFactor: 0.0833333 },
    { code: 'M',    name: 'Meter',        uomType: 'LENGTH' as const, isBaseUnit: false, conversionFactor: 3.28084 },
    { code: 'CM',   name: 'Centimeter',   uomType: 'LENGTH' as const, isBaseUnit: false, conversionFactor: 0.0328084 },
    { code: 'GAL',  name: 'Gallon',       uomType: 'VOLUME' as const, isBaseUnit: true,  conversionFactor: 1.0 },
    { code: 'L',    name: 'Liter',        uomType: 'VOLUME' as const, isBaseUnit: false, conversionFactor: 0.264172 },
    { code: 'SQF',  name: 'Square Foot',  uomType: 'AREA'   as const, isBaseUnit: true,  conversionFactor: 1.0 },
  ];

  for (const uom of uoms) {
    await prisma.unitOfMeasure.upsert({
      where: { code: uom.code },
      update: {},
      create: {
        code: uom.code,
        name: uom.name,
        uomType: uom.uomType,
        isBaseUnit: uom.isBaseUnit,
        conversionFactor: uom.conversionFactor,
      },
    });
  }
```

Note: the `isBaseUnit` and `conversionFactor` fields are not present in the Prisma schema defined in Task 1. They were listed in the task instructions as conceptual attributes. The seed only writes the fields that are part of the schema (`code`, `name`, `uomType`). If `isBaseUnit` and `conversionFactor` columns were added to the schema, include them; otherwise omit those two fields and the upsert becomes:

```typescript
  for (const uom of uoms) {
    await prisma.unitOfMeasure.upsert({
      where: { code: uom.code },
      update: {},
      create: {
        code: uom.code,
        name: uom.name,
        uomType: uom.uomType,
      },
    });
  }
```

Use whichever version matches the actual generated Prisma client. If the schema does not include `isBaseUnit`/`conversionFactor`, use the shorter form. If you added those columns to the schema, use the full form.

- [ ] **7.2** Run the seed:
```bash
cd borderworxWMS && npx prisma db seed
```

- [ ] **7.3** Commit:
```bash
git add borderworxWMS/prisma/seed.ts
git commit -m "chore: seed 15 standard UOMs (COUNT, WEIGHT, LENGTH, VOLUME, AREA)"
```

---

## Task 8: Frontend UOM Module

Create all files under `borderworxWMSFrontend/src/modules/uom/`.

- [ ] **8.1** Create `borderworxWMSFrontend/src/modules/uom/model/types.ts`:

```typescript
export type UomType = 'COUNT' | 'WEIGHT' | 'VOLUME' | 'LENGTH' | 'AREA';
export type RoundingRule = 'NEAREST' | 'UP' | 'DOWN';
export type EquivalencyGroupType = 'WEIGHT' | 'VOLUME' | 'COUNT' | 'LENGTH' | 'AREA';

export interface UnitOfMeasureDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  uomType: UomType;
  roundingRule: RoundingRule;
  decimalPlaces: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UnitOfMeasure = UnitOfMeasureDTO;

export interface UomConversionDTO {
  id: string;
  fromUomId: string;
  toUomId: string;
  fromUomCode: string;
  fromUomName: string;
  toUomCode: string;
  toUomName: string;
  conversionFactor: number;
  hierarchyLevel: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type UomConversion = UomConversionDTO;

export interface EquivalencyGroupMemberDTO {
  id: string;
  uomId: string;
  uomCode: string;
  uomName: string;
  isPrimary: boolean;
}

export interface EquivalencyGroupDTO {
  id: string;
  name: string;
  description: string | null;
  groupType: EquivalencyGroupType;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  members: EquivalencyGroupMemberDTO[];
}

export type EquivalencyGroup = EquivalencyGroupDTO;

export interface CreateUnitOfMeasureRequest {
  code: string;
  name: string;
  description?: string | null;
  uomType: UomType;
  roundingRule?: RoundingRule;
  decimalPlaces?: number;
  isActive?: boolean;
}

export type UpdateUnitOfMeasureRequest = Partial<Omit<CreateUnitOfMeasureRequest, 'code'>> & {
  isActive?: boolean;
};

export interface CreateUomConversionRequest {
  fromUomId: string;
  toUomId: string;
  conversionFactor: number;
  hierarchyLevel?: number;
}

export interface UpdateUomConversionRequest {
  conversionFactor?: number;
  hierarchyLevel?: number;
  isActive?: boolean;
}

export interface CreateEquivalencyGroupRequest {
  name: string;
  description?: string | null;
  groupType: EquivalencyGroupType;
}

export type UpdateEquivalencyGroupRequest = Partial<CreateEquivalencyGroupRequest> & {
  isActive?: boolean;
};
```

- [ ] **8.2** Create `borderworxWMSFrontend/src/modules/uom/model/schema.ts`:

```typescript
import { z } from 'zod';

export const uomDTOSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  uomType: z.enum(['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA']),
  roundingRule: z.enum(['NEAREST', 'UP', 'DOWN']),
  decimalPlaces: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const uomConversionDTOSchema = z.object({
  id: z.string(),
  fromUomId: z.string(),
  toUomId: z.string(),
  fromUomCode: z.string(),
  fromUomName: z.string(),
  toUomCode: z.string(),
  toUomName: z.string(),
  conversionFactor: z.number(),
  hierarchyLevel: z.number(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const equivalencyGroupMemberDTOSchema = z.object({
  id: z.string(),
  uomId: z.string(),
  uomCode: z.string(),
  uomName: z.string(),
  isPrimary: z.boolean(),
});

export const equivalencyGroupDTOSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  groupType: z.enum(['WEIGHT', 'VOLUME', 'COUNT', 'LENGTH', 'AREA']),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  members: z.array(equivalencyGroupMemberDTOSchema),
});

export const uomListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(uomDTOSchema),
  meta: z.object({
    page: z.number(),
    pageSize: z.number(),
    totalCount: z.number(),
    totalPages: z.number(),
  }),
});

export const uomSingleResponseSchema = z.object({
  success: z.literal(true),
  data: uomDTOSchema,
});

export const uomConversionListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(uomConversionDTOSchema),
});

export const uomConversionSingleResponseSchema = z.object({
  success: z.literal(true),
  data: uomConversionDTOSchema,
});

export const equivalencyGroupListResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(equivalencyGroupDTOSchema),
});

export const equivalencyGroupSingleResponseSchema = z.object({
  success: z.literal(true),
  data: equivalencyGroupDTOSchema,
});
```

- [ ] **8.3** Create `borderworxWMSFrontend/src/modules/uom/lib/mapUom.ts`:

```typescript
import type { UnitOfMeasureDTO, UnitOfMeasure, UomConversionDTO, UomConversion, EquivalencyGroupDTO, EquivalencyGroup } from '../model/types';

export function mapUom(dto: UnitOfMeasureDTO): UnitOfMeasure {
  return { ...dto };
}

export function mapUomList(dtos: UnitOfMeasureDTO[]): UnitOfMeasure[] {
  return dtos.map(mapUom);
}

export function mapUomConversion(dto: UomConversionDTO): UomConversion {
  return { ...dto };
}

export function mapUomConversionList(dtos: UomConversionDTO[]): UomConversion[] {
  return dtos.map(mapUomConversion);
}

export function mapEquivalencyGroup(dto: EquivalencyGroupDTO): EquivalencyGroup {
  return { ...dto };
}

export function mapEquivalencyGroupList(dtos: EquivalencyGroupDTO[]): EquivalencyGroup[] {
  return dtos.map(mapEquivalencyGroup);
}
```

- [ ] **8.4** Create `borderworxWMSFrontend/src/modules/uom/api/unit-of-measure.api.ts`:

```typescript
import { backendFetch } from '@/services/http/backendClient';
import { uomListResponseSchema, uomSingleResponseSchema } from '../model/schema';
import type { UnitOfMeasure, CreateUnitOfMeasureRequest, UpdateUnitOfMeasureRequest } from '../model/types';

interface ListUomOptions {
  uomType?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export async function listUnitOfMeasure(options: ListUomOptions, accessToken: string): Promise<UnitOfMeasure[]> {
  const params = new URLSearchParams();
  if (options.uomType) params.set('uomType', options.uomType);
  if (options.isActive !== undefined) params.set('isActive', String(options.isActive));
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));
  const qs = params.toString();
  const raw = await backendFetch<unknown>(`/api/unit-of-measure${qs ? `?${qs}` : ''}`, { accessToken });
  return uomListResponseSchema.parse(raw).data;
}

export async function createUnitOfMeasure(data: CreateUnitOfMeasureRequest, accessToken: string): Promise<UnitOfMeasure> {
  const raw = await backendFetch<unknown>('/api/unit-of-measure', { method: 'POST', body: data, accessToken });
  return uomSingleResponseSchema.parse(raw).data;
}

export async function updateUnitOfMeasure(id: string, data: UpdateUnitOfMeasureRequest, accessToken: string): Promise<UnitOfMeasure> {
  const raw = await backendFetch<unknown>(`/api/unit-of-measure/${id}`, { method: 'PATCH', body: data, accessToken });
  return uomSingleResponseSchema.parse(raw).data;
}

export async function deleteUnitOfMeasure(id: string, accessToken: string): Promise<void> {
  await backendFetch<unknown>(`/api/unit-of-measure/${id}`, { method: 'DELETE', accessToken });
}
```

- [ ] **8.5** Create `borderworxWMSFrontend/src/modules/uom/api/uom-conversion.api.ts`:

```typescript
import { backendFetch } from '@/services/http/backendClient';
import { uomConversionListResponseSchema, uomConversionSingleResponseSchema } from '../model/schema';
import type { UomConversion, CreateUomConversionRequest, UpdateUomConversionRequest } from '../model/types';

export async function listUomConversions(fromUomId: string | undefined, accessToken: string): Promise<UomConversion[]> {
  const qs = fromUomId ? `?fromUomId=${fromUomId}` : '';
  const raw = await backendFetch<unknown>(`/api/uom-conversion${qs}`, { accessToken });
  return uomConversionListResponseSchema.parse(raw).data;
}

export async function createUomConversion(data: CreateUomConversionRequest, accessToken: string): Promise<UomConversion> {
  const raw = await backendFetch<unknown>('/api/uom-conversion', { method: 'POST', body: data, accessToken });
  return uomConversionSingleResponseSchema.parse(raw).data;
}

export async function updateUomConversion(id: string, data: UpdateUomConversionRequest, accessToken: string): Promise<UomConversion> {
  const raw = await backendFetch<unknown>(`/api/uom-conversion/${id}`, { method: 'PATCH', body: data, accessToken });
  return uomConversionSingleResponseSchema.parse(raw).data;
}

export async function deleteUomConversion(id: string, accessToken: string): Promise<void> {
  await backendFetch<unknown>(`/api/uom-conversion/${id}`, { method: 'DELETE', accessToken });
}
```

- [ ] **8.6** Create `borderworxWMSFrontend/src/modules/uom/api/equivalency-group.api.ts`:

```typescript
import { backendFetch } from '@/services/http/backendClient';
import { equivalencyGroupListResponseSchema, equivalencyGroupSingleResponseSchema } from '../model/schema';
import type { EquivalencyGroup, CreateEquivalencyGroupRequest, UpdateEquivalencyGroupRequest } from '../model/types';

export async function listEquivalencyGroups(accessToken: string): Promise<EquivalencyGroup[]> {
  const raw = await backendFetch<unknown>('/api/equivalency-group', { accessToken });
  return equivalencyGroupListResponseSchema.parse(raw).data;
}

export async function createEquivalencyGroup(data: CreateEquivalencyGroupRequest, accessToken: string): Promise<EquivalencyGroup> {
  const raw = await backendFetch<unknown>('/api/equivalency-group', { method: 'POST', body: data, accessToken });
  return equivalencyGroupSingleResponseSchema.parse(raw).data;
}

export async function updateEquivalencyGroup(id: string, data: UpdateEquivalencyGroupRequest, accessToken: string): Promise<EquivalencyGroup> {
  const raw = await backendFetch<unknown>(`/api/equivalency-group/${id}`, { method: 'PATCH', body: data, accessToken });
  return equivalencyGroupSingleResponseSchema.parse(raw).data;
}

export async function deleteEquivalencyGroup(id: string, accessToken: string): Promise<void> {
  await backendFetch<unknown>(`/api/equivalency-group/${id}`, { method: 'DELETE', accessToken });
}

export async function addEquivalencyGroupMember(groupId: string, uomId: string, isPrimary: boolean, accessToken: string): Promise<EquivalencyGroup> {
  const raw = await backendFetch<unknown>(`/api/equivalency-group/${groupId}/members`, {
    method: 'POST',
    body: { uomId, isPrimary },
    accessToken,
  });
  return equivalencyGroupSingleResponseSchema.parse(raw).data;
}

export async function removeEquivalencyGroupMember(groupId: string, uomId: string, accessToken: string): Promise<EquivalencyGroup> {
  const raw = await backendFetch<unknown>(`/api/equivalency-group/${groupId}/members/${uomId}`, {
    method: 'DELETE',
    accessToken,
  });
  return equivalencyGroupSingleResponseSchema.parse(raw).data;
}
```

- [ ] **8.7** Create `borderworxWMSFrontend/src/modules/uom/index.ts` (barrel — export only what's needed by other layers; UI components are added in Task 9 and 10):

```typescript
export { listUnitOfMeasure, createUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure } from './api/unit-of-measure.api';
export { listUomConversions, createUomConversion, updateUomConversion, deleteUomConversion } from './api/uom-conversion.api';
export {
  listEquivalencyGroups,
  createEquivalencyGroup,
  updateEquivalencyGroup,
  deleteEquivalencyGroup,
  addEquivalencyGroupMember,
  removeEquivalencyGroupMember,
} from './api/equivalency-group.api';
export { mapUom, mapUomList, mapUomConversion, mapUomConversionList, mapEquivalencyGroup, mapEquivalencyGroupList } from './lib/mapUom';
export type {
  UomType,
  RoundingRule,
  EquivalencyGroupType,
  UnitOfMeasure,
  UnitOfMeasureDTO,
  UomConversion,
  UomConversionDTO,
  EquivalencyGroup,
  EquivalencyGroupDTO,
  EquivalencyGroupMemberDTO,
  CreateUnitOfMeasureRequest,
  UpdateUnitOfMeasureRequest,
  CreateUomConversionRequest,
  UpdateUomConversionRequest,
  CreateEquivalencyGroupRequest,
  UpdateEquivalencyGroupRequest,
} from './model/types';
```

- [ ] **8.8** Verify TypeScript:
```bash
cd borderworxWMSFrontend && npx tsc --noEmit
```

- [ ] **8.9** Commit:
```bash
git add borderworxWMSFrontend/src/modules/uom/
git commit -m "feat: add frontend UOM module (types, schemas, mappers, API functions)"
```

---

## Task 9: Frontend UOM UI Components

- [ ] **9.1** Create `borderworxWMSFrontend/src/modules/uom/ui/UnitsOfMeasureTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { listUnitOfMeasure, createUnitOfMeasure, updateUnitOfMeasure, deleteUnitOfMeasure } from '../api/unit-of-measure.api';
import type { UnitOfMeasure, UomType, RoundingRule, CreateUnitOfMeasureRequest, UpdateUnitOfMeasureRequest } from '../model/types';

const UOM_TYPES: UomType[] = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA'];
const ROUNDING_RULES: RoundingRule[] = ['NEAREST', 'UP', 'DOWN'];

interface Props { accessToken: string; }

export function UnitsOfMeasureTab({ accessToken }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<UnitOfMeasure | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: uoms = [], isLoading } = useQuery({
    queryKey: ['uom'],
    queryFn: () => listUnitOfMeasure({}, accessToken),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateUnitOfMeasureRequest) => createUnitOfMeasure(data, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uom'] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUnitOfMeasureRequest }) =>
      updateUnitOfMeasure(id, data, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uom'] }); setEditItem(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteUnitOfMeasure(id, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uom'] }); setDeleteConfirm(null); },
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Units of Measure</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" /> Add Unit of Measure
        </button>
      </div>

      {isLoading ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : uoms.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No units of measure defined</p>
          <p className="mt-1 text-xs text-gray-300">Click &ldquo;Add Unit of Measure&rdquo; to get started</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Rounding</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Decimals</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {uoms.map((uom) => (
                <tr key={uom.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-gray-700">
                      {uom.code}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{uom.name}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {uom.uomType}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{uom.roundingRule}</td>
                  <td className="px-4 py-3 text-gray-500">{uom.decimalPlaces}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${uom.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {uom.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditItem(uom)}
                        className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {deleteConfirm === uom.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => deleteMut.mutate(uom.id)}
                            disabled={deleteMut.isPending}
                            className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(null)}
                            className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(uom.id)}
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <UomFormModal
          title="Add Unit of Measure"
          onSave={(data) => createMut.mutate(data as CreateUnitOfMeasureRequest)}
          onClose={() => setShowCreate(false)}
          saving={createMut.isPending}
        />
      )}

      {editItem && (
        <UomFormModal
          title="Edit Unit of Measure"
          initial={editItem}
          onSave={(data) => updateMut.mutate({ id: editItem.id, data: data as UpdateUnitOfMeasureRequest })}
          onClose={() => setEditItem(null)}
          saving={updateMut.isPending}
          isEdit
        />
      )}
    </div>
  );
}

function UomFormModal({
  title, initial, onSave, onClose, saving, isEdit = false,
}: {
  title: string;
  initial?: UnitOfMeasure;
  onSave: (data: CreateUnitOfMeasureRequest | UpdateUnitOfMeasureRequest) => void;
  onClose: () => void;
  saving: boolean;
  isEdit?: boolean;
}) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [uomType, setUomType] = useState<UomType>(initial?.uomType ?? 'COUNT');
  const [roundingRule, setRoundingRule] = useState<RoundingRule>(initial?.roundingRule ?? 'NEAREST');
  const [decimalPlaces, setDecimalPlaces] = useState(String(initial?.decimalPlaces ?? 2));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function handleSave() {
    if (isEdit) {
      onSave({ name, description: description || null, uomType, roundingRule, decimalPlaces: Number(decimalPlaces), isActive });
    } else {
      onSave({ code: code.toUpperCase(), name, description: description || null, uomType, roundingRule, decimalPlaces: Number(decimalPlaces), isActive });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          {!isEdit && (
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
              Code *
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. EA"
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Each"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Type *
            <select
              value={uomType}
              onChange={(e) => setUomType(e.target.value as UomType)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {UOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
              Rounding Rule
              <select
                value={roundingRule}
                onChange={(e) => setRoundingRule(e.target.value as RoundingRule)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {ROUNDING_RULES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
              Decimal Places
              <input
                type="number"
                min="0"
                max="10"
                value={decimalPlaces}
                onChange={(e) => setDecimalPlaces(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
            Active
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={(!isEdit && !code) || !name || saving}
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **9.2** Create `borderworxWMSFrontend/src/modules/uom/ui/ConversionsTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { listUomConversions, createUomConversion, updateUomConversion } from '../api/uom-conversion.api';
import { listUnitOfMeasure } from '../api/unit-of-measure.api';
import type { UomConversion, CreateUomConversionRequest, UpdateUomConversionRequest } from '../model/types';

interface Props { accessToken: string; }

export function ConversionsTab({ accessToken }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<UomConversion | null>(null);

  const { data: conversions = [], isLoading } = useQuery({
    queryKey: ['uom-conversions'],
    queryFn: () => listUomConversions(undefined, accessToken),
    staleTime: 60_000,
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uom'],
    queryFn: () => listUnitOfMeasure({}, accessToken),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateUomConversionRequest) => createUomConversion(data, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uom-conversions'] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUomConversionRequest }) =>
      updateUomConversion(id, data, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['uom-conversions'] }); setEditItem(null); },
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">UOM Conversions</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add Conversion
        </button>
      </div>

      {isLoading ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : conversions.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No conversions defined</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">From UOM</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">To UOM</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Conversion Factor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Level</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {conversions.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-blue-600">{c.fromUomCode}</span>
                    <span className="ml-1.5 text-gray-500">{c.fromUomName}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs font-semibold text-blue-600">{c.toUomCode}</span>
                    <span className="ml-1.5 text-gray-500">{c.toUomName}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-gray-700">{c.conversionFactor}</td>
                  <td className="px-4 py-3 text-gray-500">{c.hierarchyLevel}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setEditItem(c)}
                      className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <ConversionFormModal
          uoms={uoms}
          onSave={(data) => createMut.mutate(data as CreateUomConversionRequest)}
          onClose={() => setShowCreate(false)}
          saving={createMut.isPending}
        />
      )}

      {editItem && (
        <ConversionFormModal
          uoms={uoms}
          initial={editItem}
          onSave={(data) => updateMut.mutate({ id: editItem.id, data: data as UpdateUomConversionRequest })}
          onClose={() => setEditItem(null)}
          saving={updateMut.isPending}
          isEdit
        />
      )}
    </div>
  );
}

function ConversionFormModal({
  uoms, initial, onSave, onClose, saving, isEdit = false,
}: {
  uoms: { id: string; code: string; name: string }[];
  initial?: UomConversion;
  onSave: (data: CreateUomConversionRequest | UpdateUomConversionRequest) => void;
  onClose: () => void;
  saving: boolean;
  isEdit?: boolean;
}) {
  const [fromUomId, setFromUomId] = useState(initial?.fromUomId ?? '');
  const [toUomId, setToUomId] = useState(initial?.toUomId ?? '');
  const [conversionFactor, setConversionFactor] = useState(String(initial?.conversionFactor ?? ''));
  const [hierarchyLevel, setHierarchyLevel] = useState(String(initial?.hierarchyLevel ?? '0'));

  function handleSave() {
    if (isEdit) {
      onSave({ conversionFactor: Number(conversionFactor), hierarchyLevel: Number(hierarchyLevel) });
    } else {
      onSave({ fromUomId, toUomId, conversionFactor: Number(conversionFactor), hierarchyLevel: Number(hierarchyLevel) });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? 'Edit Conversion' : 'Add Conversion'}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          {!isEdit && (
            <>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                From UOM *
                <select
                  value={fromUomId}
                  onChange={(e) => setFromUomId(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select…</option>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
                To UOM *
                <select
                  value={toUomId}
                  onChange={(e) => setToUomId(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select…</option>
                  {uoms.map((u) => (
                    <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Conversion Factor *
            <input
              type="number"
              step="any"
              min="0"
              value={conversionFactor}
              onChange={(e) => setConversionFactor(e.target.value)}
              placeholder="e.g. 12"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Hierarchy Level
            <input
              type="number"
              min="0"
              step="1"
              value={hierarchyLevel}
              onChange={(e) => setHierarchyLevel(e.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={(!isEdit && (!fromUomId || !toUomId)) || !conversionFactor || saving}
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **9.3** Create `borderworxWMSFrontend/src/modules/uom/ui/EquivalencyGroupsTab.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import {
  listEquivalencyGroups,
  createEquivalencyGroup,
  updateEquivalencyGroup,
  deleteEquivalencyGroup,
  addEquivalencyGroupMember,
  removeEquivalencyGroupMember,
} from '../api/equivalency-group.api';
import { listUnitOfMeasure } from '../api/unit-of-measure.api';
import type { EquivalencyGroup, EquivalencyGroupType, CreateEquivalencyGroupRequest, UpdateEquivalencyGroupRequest } from '../model/types';

const GROUP_TYPES: EquivalencyGroupType[] = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA'];

interface Props { accessToken: string; }

export function EquivalencyGroupsTab({ accessToken }: Props) {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState<EquivalencyGroup | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [addMemberUomId, setAddMemberUomId] = useState<Record<string, string>>({});

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['equivalency-groups'],
    queryFn: () => listEquivalencyGroups(accessToken),
    staleTime: 60_000,
  });

  const { data: uoms = [] } = useQuery({
    queryKey: ['uom'],
    queryFn: () => listUnitOfMeasure({}, accessToken),
    staleTime: 60_000,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateEquivalencyGroupRequest) => createEquivalencyGroup(data, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equivalency-groups'] }); setShowCreate(false); },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateEquivalencyGroupRequest }) =>
      updateEquivalencyGroup(id, data, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equivalency-groups'] }); setEditItem(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteEquivalencyGroup(id, accessToken),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['equivalency-groups'] }); setDeleteConfirm(null); },
  });

  const addMemberMut = useMutation({
    mutationFn: ({ groupId, uomId }: { groupId: string; uomId: string }) =>
      addEquivalencyGroupMember(groupId, uomId, false, accessToken),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['equivalency-groups'] });
      setAddMemberUomId((prev) => ({ ...prev, [vars.groupId]: '' }));
    },
  });

  const removeMemberMut = useMutation({
    mutationFn: ({ groupId, uomId }: { groupId: string; uomId: string }) =>
      removeEquivalencyGroupMember(groupId, uomId, accessToken),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['equivalency-groups'] }),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Equivalency Groups</h2>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
        >
          + Add Group
        </button>
      </div>

      {isLoading ? (
        <p className="px-6 py-8 text-center text-sm text-gray-400">Loading…</p>
      ) : groups.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-sm text-gray-400">No equivalency groups defined</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {groups.map((group) => (
            <div key={group.id}>
              <div
                className="flex cursor-pointer items-center gap-3 px-6 py-4 hover:bg-gray-50"
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{group.name}</span>
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {group.groupType}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${group.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {group.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {group.description && (
                    <p className="mt-0.5 text-xs text-gray-400">{group.description}</p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setEditItem(group)}
                    className="rounded p-1 text-gray-400 hover:bg-blue-50 hover:text-blue-500"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  {deleteConfirm === group.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => deleteMut.mutate(group.id)}
                        disabled={deleteMut.isPending}
                        className="rounded px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirm(null)}
                        className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDeleteConfirm(group.id)}
                      className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {expandedGroup === group.id ? (
                    <ChevronUp className="h-4 w-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-gray-400" />
                  )}
                </div>
              </div>

              {expandedGroup === group.id && (
                <div className="border-t border-gray-100 bg-gray-50 px-6 py-4">
                  <h4 className="mb-3 text-xs font-semibold text-gray-600">Members</h4>
                  {group.members.length === 0 ? (
                    <p className="mb-3 text-xs text-gray-400">No members yet</p>
                  ) : (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {group.members.map((m) => (
                        <div key={m.id} className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5">
                          <span className="font-mono text-xs font-semibold text-blue-600">{m.uomCode}</span>
                          <span className="text-xs text-gray-500">{m.uomName}</span>
                          {m.isPrimary && (
                            <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">Primary</span>
                          )}
                          <button
                            type="button"
                            onClick={() => removeMemberMut.mutate({ groupId: group.id, uomId: m.uomId })}
                            disabled={removeMemberMut.isPending}
                            className="ml-0.5 text-gray-300 hover:text-red-400"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <select
                      value={addMemberUomId[group.id] ?? ''}
                      onChange={(e) => setAddMemberUomId((prev) => ({ ...prev, [group.id]: e.target.value }))}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Add UOM…</option>
                      {uoms
                        .filter((u) => !group.members.some((m) => m.uomId === u.id))
                        .map((u) => (
                          <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={!addMemberUomId[group.id] || addMemberMut.isPending}
                      onClick={() => addMemberMut.mutate({ groupId: group.id, uomId: addMemberUomId[group.id] })}
                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <GroupFormModal
          title="Add Equivalency Group"
          onSave={(data) => createMut.mutate(data as CreateEquivalencyGroupRequest)}
          onClose={() => setShowCreate(false)}
          saving={createMut.isPending}
        />
      )}

      {editItem && (
        <GroupFormModal
          title="Edit Equivalency Group"
          initial={editItem}
          onSave={(data) => updateMut.mutate({ id: editItem.id, data: data as UpdateEquivalencyGroupRequest })}
          onClose={() => setEditItem(null)}
          saving={updateMut.isPending}
          isEdit
        />
      )}
    </div>
  );
}

function GroupFormModal({
  title, initial, onSave, onClose, saving, isEdit = false,
}: {
  title: string;
  initial?: EquivalencyGroup;
  onSave: (data: CreateEquivalencyGroupRequest | UpdateEquivalencyGroupRequest) => void;
  onClose: () => void;
  saving: boolean;
  isEdit?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [groupType, setGroupType] = useState<EquivalencyGroupType>(initial?.groupType ?? 'COUNT');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);

  function handleSave() {
    if (isEdit) {
      onSave({ name, description: description || null, groupType, isActive });
    } else {
      onSave({ name, description: description || null, groupType });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex flex-col gap-4 px-6 py-5">
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Name *
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weight Equivalencies"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Group Type *
            <select
              value={groupType}
              onChange={(e) => setGroupType(e.target.value as EquivalencyGroupType)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {GROUP_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-gray-500">
            Description
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>
          {isEdit && (
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded text-blue-600" />
              Active
            </label>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-200 px-4 py-2 text-sm">Cancel</button>
          <button
            type="button"
            disabled={!name || saving}
            onClick={handleSave}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **9.4** Verify TypeScript:
```bash
cd borderworxWMSFrontend && npx tsc --noEmit
```

- [ ] **9.5** Commit:
```bash
git add borderworxWMSFrontend/src/modules/uom/ui/
git commit -m "feat: add UOM UI components (UnitsOfMeasureTab, ConversionsTab, EquivalencyGroupsTab)"
```

---

## Task 10: Frontend UOM Page + Navigation

- [ ] **10.1** Create `borderworxWMSFrontend/src/modules/uom/ui/UomTabsClient.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { UnitsOfMeasureTab } from './UnitsOfMeasureTab';
import { ConversionsTab } from './ConversionsTab';
import { EquivalencyGroupsTab } from './EquivalencyGroupsTab';

type ActiveTab = 'units' | 'conversions' | 'equivalency';

interface Props { accessToken: string; }

export function UomTabsClient({ accessToken }: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('units');

  const tabs: { key: ActiveTab; label: string }[] = [
    { key: 'units', label: 'Units of Measure' },
    { key: 'conversions', label: 'Conversions' },
    { key: 'equivalency', label: 'Equivalency Groups' },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'units' && <UnitsOfMeasureTab accessToken={accessToken} />}
      {activeTab === 'conversions' && <ConversionsTab accessToken={accessToken} />}
      {activeTab === 'equivalency' && <EquivalencyGroupsTab accessToken={accessToken} />}
    </div>
  );
}
```

- [ ] **10.2** Update `borderworxWMSFrontend/src/modules/uom/index.ts` to export the new UI components. Add these exports:

```typescript
export { UomTabsClient } from './ui/UomTabsClient';
export { UnitsOfMeasureTab } from './ui/UnitsOfMeasureTab';
export { ConversionsTab } from './ui/ConversionsTab';
export { EquivalencyGroupsTab } from './ui/EquivalencyGroupsTab';
```

- [ ] **10.3** Create `borderworxWMSFrontend/src/modules/item/ui/ItemsTabBar.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/shared/config/routes';

export function ItemsTabBar() {
  const pathname = usePathname();
  const tabs = [
    { label: 'Items', href: ROUTES.items },
    { label: 'Unit of Measures', href: ROUTES.itemsUom },
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`flex-1 rounded-lg px-4 py-2 text-center text-sm font-medium transition-colors ${
            pathname === tab.href
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **10.4** Edit `borderworxWMSFrontend/src/modules/item/index.ts`. Add this export line at the end of the UI exports section:

```typescript
export { ItemsTabBar } from './ui/ItemsTabBar';
```

- [ ] **10.5** Edit `borderworxWMSFrontend/src/shared/config/routes.ts`:

In the `ROUTES` object, add after `kitsNew`:
```typescript
  itemsUom: '/items/uom',
```

In the `PROTECTED_PATHS` array, add after `'/items/kits/new'`:
```typescript
  '/items/uom',
```

- [ ] **10.6** Edit `borderworxWMSFrontend/src/app/(protected)/items/page.tsx`. Import `ItemsTabBar` and render it above `ItemTable`:

```tsx
import { getAccessToken } from '@/services/auth/getSession';
import { ItemTable, ItemsTabBar } from '@/modules/item';

export default async function ItemsPage() {
  const accessToken = await getAccessToken();
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Items</h1>
        <p className="text-sm text-gray-500">Manage your SKU catalog</p>
      </div>
      <ItemsTabBar />
      <ItemTable accessToken={accessToken!} />
    </div>
  );
}
```

- [ ] **10.7** Create `borderworxWMSFrontend/src/app/(protected)/items/uom/page.tsx`:

```tsx
import { getAccessToken } from '@/services/auth/getSession';
import { ItemsTabBar } from '@/modules/item';
import { UomTabsClient } from '@/modules/uom';

export default async function ItemsUomPage() {
  const accessToken = await getAccessToken();
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Unit of Measure</h1>
        <p className="text-sm text-gray-500">Manage units of measure, conversions, and hierarchical relationships</p>
      </div>
      <ItemsTabBar />
      <UomTabsClient accessToken={accessToken!} />
    </div>
  );
}
```

- [ ] **10.8** Verify TypeScript:
```bash
cd borderworxWMSFrontend && npx tsc --noEmit
```

- [ ] **10.9** Commit:
```bash
git add \
  borderworxWMSFrontend/src/modules/uom/ui/UomTabsClient.tsx \
  borderworxWMSFrontend/src/modules/uom/index.ts \
  borderworxWMSFrontend/src/modules/item/ui/ItemsTabBar.tsx \
  borderworxWMSFrontend/src/modules/item/index.ts \
  borderworxWMSFrontend/src/shared/config/routes.ts \
  borderworxWMSFrontend/src/app/(protected)/items/page.tsx \
  borderworxWMSFrontend/src/app/(protected)/items/uom/page.tsx
git commit -m "feat: add UOM management page at /items/uom with ItemsTabBar navigation"
```

---

## Task 11: UomSelect + CreateItemForm Update

- [ ] **11.1** Create `borderworxWMSFrontend/src/shared/ui/selectors/UomSelect.tsx`:

```tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { backendFetch } from '@/services/http/backendClient';
import { z } from 'zod';

const uomItemSchema = z.object({ id: z.string(), code: z.string(), name: z.string() });
const listSchema = z.object({
  success: z.literal(true),
  data: z.array(uomItemSchema),
  meta: z.object({ totalCount: z.number() }).passthrough(),
});

interface UomSelectProps {
  value: string;
  onChange: (id: string, code: string, name: string) => void;
  accessToken: string;
  required?: boolean;
  placeholder?: string;
}

export function UomSelect({ value, onChange, accessToken, required, placeholder = 'Select UOM…' }: UomSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [options, setOptions] = useState<{ id: string; code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    backendFetch<unknown>('/api/unit-of-measure?isActive=true&pageSize=200', { accessToken })
      .then((raw) => {
        const parsed = listSchema.safeParse(raw);
        if (parsed.success) setOptions(parsed.data.data);
      })
      .finally(() => setLoading(false));
  }, [accessToken]);

  useEffect(() => {
    if (value && options.length) {
      const found = options.find((o) => o.id === value);
      if (found) setSelectedLabel(`${found.code} — ${found.name}`);
    }
    if (!value) setSelectedLabel('');
  }, [value, options]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  const filtered = options.filter((o) =>
    `${o.code} ${o.name}`.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-lg border px-3 py-2 text-left text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
          value ? 'border-gray-200 text-gray-900' : 'border-gray-200 text-gray-400'
        }`}
      >
        {selectedLabel || placeholder}
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400">▾</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="p-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name…"
              className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-2 text-xs text-gray-400">Loading…</li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-gray-400">No results</li>
            ) : (
              filtered.map((o) => (
                <li
                  key={o.id}
                  onClick={() => {
                    onChange(o.id, o.code, o.name);
                    setSelectedLabel(`${o.code} — ${o.name}`);
                    setOpen(false);
                    setSearch('');
                  }}
                  className={`cursor-pointer px-3 py-2 text-sm hover:bg-blue-50 ${
                    value === o.id ? 'bg-blue-50 font-medium text-blue-700' : 'text-gray-700'
                  }`}
                >
                  <span className="font-mono text-xs font-semibold text-blue-600">{o.code}</span>
                  <span className="ml-2 text-gray-700">{o.name}</span>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
      {required && <input required value={value} onChange={() => {}} className="sr-only" tabIndex={-1} />}
    </div>
  );
}
```

- [ ] **11.2** Edit `borderworxWMSFrontend/src/shared/ui/selectors/index.ts`. Add at the end:

```typescript
export { UomSelect } from './UomSelect';
```

- [ ] **11.3** Edit `borderworxWMSFrontend/src/modules/item/model/types.ts`:

Replace:
```typescript
  unitOfMeasure: string;
```
with:
```typescript
  unitOfMeasureId: string | null;
  unitOfMeasure: { id: string; code: string; name: string } | null;
```

Replace:
```typescript
  unitOfMeasure?: string;
```
(in `CreateItemRequest`) with:
```typescript
  unitOfMeasureId?: string | null;
```

- [ ] **11.4** Edit `borderworxWMSFrontend/src/modules/item/model/schema.ts`:

Replace:
```typescript
  unitOfMeasure: z.string(),
```
(in `itemDTOSchema`) with:
```typescript
  unitOfMeasureId: z.string().nullable(),
  unitOfMeasure: z.object({ id: z.string(), code: z.string(), name: z.string() }).nullable(),
```

Replace:
```typescript
  unitOfMeasure: z.string().min(1).max(50).optional(),
```
(in `createItemSchema`) with:
```typescript
  unitOfMeasureId: z.string().uuid().nullable().optional(),
```

- [ ] **11.5** Edit `borderworxWMSFrontend/src/modules/item/ui/CreateItemForm.tsx`. Make the following targeted changes:

**a.** Add import for `UomSelect` at the top of the imports section (after the existing `Spinner` import):
```typescript
import { UomSelect } from '@/shared/ui/selectors';
```

**b.** Add `unitOfMeasureId: string` to the `ItemFormValues` type (after `imageUrl: string`):
```typescript
  unitOfMeasureId: string;
```

**c.** Add `unitOfMeasureId: ''` to `emptyItem` (after `imageUrl: ''`):
```typescript
  unitOfMeasureId: '',
```

**d.** In the `toRequest` function, add `unitOfMeasureId` to the return object (after `imageUrl`):
```typescript
      unitOfMeasureId: v.unitOfMeasureId || null,
```

**e.** In the Items tab section (Tab 1), inside the General section, locate the `<Field label="Item Cost"` block. Add a UOM field immediately before it (so it sits in the right column of the `grid grid-cols-2 gap-4` that contains the image and cost fields). Since the image/cost block is a `grid grid-cols-2`, add a new Field below the existing Sell Price field or as a separate Field in the General section after the description field:

After the `<Field label="Description"` block and before the `<label className="flex items-center gap-3` (Active toggle), add:
```tsx
                <Field label="Unit of Measure">
                  <UomSelect
                    value={itemValues.unitOfMeasureId}
                    onChange={(id) => setItem('unitOfMeasureId', id)}
                    accessToken={accessToken}
                    placeholder="Select unit of measure…"
                  />
                </Field>
```

- [ ] **11.6** Verify TypeScript:
```bash
cd borderworxWMSFrontend && npx tsc --noEmit
```

- [ ] **11.7** Commit:
```bash
git add \
  borderworxWMSFrontend/src/shared/ui/selectors/UomSelect.tsx \
  borderworxWMSFrontend/src/shared/ui/selectors/index.ts \
  borderworxWMSFrontend/src/modules/item/model/types.ts \
  borderworxWMSFrontend/src/modules/item/model/schema.ts \
  borderworxWMSFrontend/src/modules/item/ui/CreateItemForm.tsx
git commit -m "feat: add UomSelect component and wire unitOfMeasureId into CreateItemForm"
```
