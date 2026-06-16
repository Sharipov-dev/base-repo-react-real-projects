# Users/Roles RBAC — Phase 1 (Core Security) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make RBAC actually enforced in the backend — granular permissions (hybrid code-catalog + DB), warehouse scoping, and per-endpoint permission + scope + status guards.

**Architecture:** Permission keys are defined in a typed code catalog (source of truth), synced into a `Permission` table; roles link to permissions via `RolePermission`; users scope to warehouses via `UserWarehouse` (internal) or existing `CustomerWarehouse` (customer). Two resolvers (effective-permissions, allowed-warehouses) feed two Express middlewares (`requirePermission`, `requireWarehouseScope`) plus a status check in auth.

**Tech Stack:** Express, Prisma, PostgreSQL, Supabase JWT, Vitest + supertest. Clean Architecture (domain / application / infrastructure / interfaces / main). Manual DI in `src/main/container.ts`.

**Repo:** `borderworxWMS` (backend submodule). **Branch:** start from a CLEAN tree on a new branch `feat/rbac-phase1` (the working tree currently has unrelated uncommitted work on `feat/wms-phase2` — commit/stash that first).

**Permission convention:** dot-notation `resource.action` (matches existing seed data, e.g. `receipts.read`). Two system keys: `system.all` (superadmin bypass for permission checks) and `system.all-warehouses` (cross-warehouse bypass for scope checks).

---

## Pre-flight (do once, not a TDD task)

- [ ] **P0: Ensure clean tree + branch**

```bash
cd borderworxWMS
git status --short            # expect: clean (commit or stash feat/wms-phase2 work first)
git checkout -b feat/rbac-phase1
npm install                   # ensure deps present
npm run test -- --run         # baseline: existing tests pass
```
Expected: tests pass (green baseline) before any changes.

---

## Task 1: Prisma schema — Permission, RolePermission, UserWarehouse, relations

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and relations**

In `prisma/schema.prisma`, change the `Role` model — remove the `permissions Json` line and add the back-relation:

```prisma
model Role {
  id          String   @id @default(uuid())
  name        String   @unique
  description String?
  roleType    RoleType @default(warehouse) @map("role_type")
  isActive    Boolean  @default(true) @map("is_active")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  rolePermissions RolePermission[]
  users           User[]

  @@map("roles")
}
```

Change the `User` model — add the `role` relation and `warehouses` back-relation (keep all existing fields):

```prisma
  // inside model User, after existing fields, alongside `customer` relation:
  role       Role?           @relation(fields: [roleId], references: [id])
  warehouses UserWarehouse[]
```

Add to the `Warehouse` model relations block:

```prisma
  userWarehouses UserWarehouse[]
```

Append these new models at the end of the file:

```prisma
model Permission {
  id           String   @id @default(uuid())
  key          String   @unique          // e.g. "inventory.adjust"
  resource     String
  action       String
  description  String?
  isDeprecated Boolean  @default(false) @map("is_deprecated")
  createdAt    DateTime @default(now()) @map("created_at")

  rolePermissions RolePermission[]

  @@map("permissions")
}

model RolePermission {
  roleId       String @map("role_id")
  permissionId String @map("permission_id")

  role       Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model UserWarehouse {
  userId      String   @map("user_id")
  warehouseId String   @map("warehouse_id")
  createdAt   DateTime @default(now()) @map("created_at")

  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  warehouse Warehouse @relation(fields: [warehouseId], references: [id], onDelete: Cascade)

  @@id([userId, warehouseId])
  @@map("user_warehouses")
}

model AuditLog {
  id          String   @id @default(uuid())
  actorUserId String?  @map("actor_user_id")
  action      String
  entityType  String   @map("entity_type")
  entityId    String?  @map("entity_id")
  before      Json?
  after       Json?
  ip          String?
  createdAt   DateTime @default(now()) @map("created_at")

  @@index([actorUserId])
  @@index([entityType, entityId])
  @@index([createdAt])
  @@map("audit_logs")
}
```

> Note: `AuditLog` is added here so the migration is single, but it is *used* in Phase 2.

- [ ] **Step 2: Create the migration (do NOT deploy to prod)**

Run against a local/dev DB only:

```bash
npm run prisma:migrate:dev -- --name rbac_phase1_permissions_scoping --create-only
```
Expected: a new folder `prisma/migrations/<ts>_rbac_phase1_permissions_scoping/migration.sql` is generated WITHOUT applying. Review the SQL: it must `CREATE TABLE permissions/role_permissions/user_warehouses/audit_logs`, add `users.role_id` FK, and `DROP COLUMN roles.permissions`.

- [ ] **Step 3: Guard the data migration**

The auto-generated SQL will `DROP COLUMN "permissions"` on `roles`, destroying existing role permission data. Before that DROP, the data must be migrated (Task 5). For now, **edit the migration.sql**: cut the `ALTER TABLE "roles" DROP COLUMN "permissions";` line and paste it at the very END of the file (so new tables exist first; the data backfill in Task 5 runs as a seed step before this migration is applied in CI — see Task 5 notes). Leave a comment:

```sql
-- NOTE: roles.permissions drop is intentionally last; backfill RolePermission rows before applying (see seed sync).
```

- [ ] **Step 4: Apply migration locally + regenerate client**

```bash
npm run prisma:migrate:dev          # applies pending migration to dev DB
npm run prisma:generate
npm run typecheck
```
Expected: migration applies; `npx prisma generate` succeeds; `tsc --noEmit` passes EXCEPT for known breakages in role repository/use-cases that reference `permissions` (fixed in Task 6). Note them; do not fix yet.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(rbac): add Permission/RolePermission/UserWarehouse/AuditLog models"
```

---

## Task 2: Permission catalog (code source of truth)

**Files:**
- Create: `src/domain/auth/permission-catalog.ts`
- Test: `tests/unit/auth/permission-catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/auth/permission-catalog.test.ts
import { describe, it, expect } from 'vitest';
import { PERMISSION_CATALOG, PERMISSION_KEYS, isKnownPermission, SYSTEM_ALL, SYSTEM_ALL_WAREHOUSES } from '@domain/auth/permission-catalog.js';

describe('permission catalog', () => {
  it('has unique keys in resource.action form', () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of PERMISSION_CATALOG) {
      expect(p.key).toBe(`${p.resource}.${p.action}`);
    }
  });

  it('includes core resources and system keys', () => {
    expect(PERMISSION_KEYS).toContain('users.read');
    expect(PERMISSION_KEYS).toContain('inventory.adjust');
    expect(PERMISSION_KEYS).toContain(SYSTEM_ALL);
    expect(PERMISSION_KEYS).toContain(SYSTEM_ALL_WAREHOUSES);
  });

  it('recognises known and rejects unknown permissions', () => {
    expect(isKnownPermission('users.create')).toBe(true);
    expect(isKnownPermission('does.notexist')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/auth/permission-catalog.test.ts`
Expected: FAIL — cannot resolve `@domain/auth/permission-catalog.js`.

- [ ] **Step 3: Write the catalog**

```typescript
// src/domain/auth/permission-catalog.ts
export interface PermissionDef {
  key: string;
  resource: string;
  action: string;
  description: string;
}

export const SYSTEM_ALL = 'system.all';
export const SYSTEM_ALL_WAREHOUSES = 'system.all-warehouses';

// Standard CRUD actions applied per resource, plus special actions.
const CRUD = ['read', 'create', 'update', 'delete'] as const;

const RESOURCES: Array<{ resource: string; actions: string[] }> = [
  { resource: 'users', actions: [...CRUD, 'invite'] },
  { resource: 'roles', actions: [...CRUD, 'assign'] },
  { resource: 'permissions', actions: ['read'] },
  { resource: 'customers', actions: [...CRUD] },
  { resource: 'organizations', actions: [...CRUD] },
  { resource: 'warehouses', actions: [...CRUD] },
  { resource: 'locations', actions: [...CRUD] },
  { resource: 'items', actions: [...CRUD] },
  { resource: 'inventory', actions: ['read', 'update', 'adjust'] },
  { resource: 'receipts', actions: [...CRUD, 'process'] },
  { resource: 'orders', actions: [...CRUD, 'ship'] },
  { resource: 'returns', actions: [...CRUD, 'process'] },
  { resource: 'purchaseOrders', actions: [...CRUD] },
  { resource: 'putaway', actions: ['read', 'confirm'] },
  { resource: 'uom', actions: [...CRUD] },
  { resource: 'suppliers', actions: [...CRUD] },
  { resource: 'shippers', actions: [...CRUD] },
  { resource: 'audit', actions: ['read'] },
];

function build(): PermissionDef[] {
  const defs: PermissionDef[] = [];
  for (const { resource, actions } of RESOURCES) {
    for (const action of actions) {
      defs.push({
        key: `${resource}.${action}`,
        resource,
        action,
        description: `${action} ${resource}`,
      });
    }
  }
  defs.push({ key: SYSTEM_ALL, resource: 'system', action: 'all', description: 'Superadmin: bypass all permission checks' });
  defs.push({ key: SYSTEM_ALL_WAREHOUSES, resource: 'system', action: 'all-warehouses', description: 'Access data across all warehouses' });
  return defs;
}

export const PERMISSION_CATALOG: PermissionDef[] = build();
export const PERMISSION_KEYS: string[] = PERMISSION_CATALOG.map((p) => p.key);
const KEY_SET = new Set(PERMISSION_KEYS);

export function isKnownPermission(key: string): boolean {
  return KEY_SET.has(key);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/auth/permission-catalog.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/auth/permission-catalog.ts tests/unit/auth/permission-catalog.test.ts
git commit -m "feat(rbac): add typed permission catalog"
```

---

## Task 3: Permission resolver (effective permissions for a user)

**Files:**
- Create: `src/application/auth/permission-resolver.ts`
- Test: `tests/unit/auth/permission-resolver.test.ts`

The resolver takes a set of permission keys a user holds (via role) and answers `has(required)`. `system.all` grants everything.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/auth/permission-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { makePermissionChecker } from '@application/auth/permission-resolver.js';

describe('permission resolver', () => {
  it('grants only held permissions', () => {
    const can = makePermissionChecker(['users.read', 'orders.read']);
    expect(can('users.read')).toBe(true);
    expect(can('users.delete')).toBe(false);
  });

  it('system.all grants everything', () => {
    const can = makePermissionChecker(['system.all']);
    expect(can('users.delete')).toBe(true);
    expect(can('anything.at-all')).toBe(true);
  });

  it('empty set grants nothing', () => {
    const can = makePermissionChecker([]);
    expect(can('users.read')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/auth/permission-resolver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the resolver**

```typescript
// src/application/auth/permission-resolver.ts
import { SYSTEM_ALL } from '@domain/auth/permission-catalog.js';

export type PermissionChecker = (required: string) => boolean;

export function makePermissionChecker(held: string[]): PermissionChecker {
  const set = new Set(held);
  const isSuper = set.has(SYSTEM_ALL);
  return (required: string): boolean => isSuper || set.has(required);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/auth/permission-resolver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/application/auth/permission-resolver.ts tests/unit/auth/permission-resolver.test.ts
git commit -m "feat(rbac): add permission resolver"
```

---

## Task 4: Auth-context loader repository (user → role → permissions + warehouses)

**Files:**
- Create: `src/domain/auth/auth-context.ts`
- Create: `src/domain/repositories/auth-context.repository.ts`
- Create: `src/infrastructure/repositories/prisma-auth-context.repository.ts`
- Test: `tests/integration/auth/prisma-auth-context.repository.test.ts` (DB-backed; mark skip if no test DB — see note)

This loads, for a given `userId`, the data the guards need: status, userType, permission keys, explicit warehouse IDs, and customerId.

- [ ] **Step 1: Define the context type and repository interface**

```typescript
// src/domain/auth/auth-context.ts
export interface AuthContext {
  userId: string;
  status: 'active' | 'inactive' | 'pending' | 'suspended';
  userType: 'internal' | 'external' | 'customer';
  customerId: string | null;
  permissionKeys: string[];
  warehouseIds: string[]; // explicit UserWarehouse assignments (internal users)
}
```

```typescript
// src/domain/repositories/auth-context.repository.ts
import type { AuthContext } from '../auth/auth-context.js';

export interface AuthContextRepository {
  loadByUserId(userId: string): Promise<AuthContext | null>;
}
```

- [ ] **Step 2: Implement the Prisma repository**

```typescript
// src/infrastructure/repositories/prisma-auth-context.repository.ts
import type { PrismaClient } from '@prisma/client';

import type { AuthContext } from '../../domain/auth/auth-context.js';
import type { AuthContextRepository } from '../../domain/repositories/auth-context.repository.js';

export class PrismaAuthContextRepository implements AuthContextRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async loadByUserId(userId: string): Promise<AuthContext | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { rolePermissions: { include: { permission: true } } } },
        warehouses: true,
      },
    });
    if (!user) return null;

    return {
      userId: user.id,
      status: user.status,
      userType: user.userType,
      customerId: user.customerId,
      permissionKeys: user.role?.rolePermissions.map((rp) => rp.permission.key) ?? [],
      warehouseIds: user.warehouses.map((w) => w.warehouseId),
    };
  }
}
```

- [ ] **Step 3: Integration test (DB-backed)**

```typescript
// tests/integration/auth/prisma-auth-context.repository.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaAuthContextRepository } from '@infrastructure/repositories/prisma-auth-context.repository.js';

// Requires a real test DATABASE_URL with migrations applied.
// Run: DATABASE_URL=... npm run test:integration
const prisma = new PrismaClient();
const repo = new PrismaAuthContextRepository(prisma);

describe('PrismaAuthContextRepository', () => {
  let userId = '';
  beforeAll(async () => {
    const perm = await prisma.permission.upsert({ where: { key: 'orders.read' }, update: {}, create: { key: 'orders.read', resource: 'orders', action: 'read' } });
    const role = await prisma.role.create({ data: { name: `T-${Date.now()}`, roleType: 'warehouse', rolePermissions: { create: [{ permissionId: perm.id }] } } });
    const user = await prisma.user.create({ data: { email: `t-${Date.now()}@x.io`, firstName: 'T', lastName: 'U', status: 'active', userType: 'internal', roleId: role.id } });
    userId = user.id;
  });
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('loads permission keys and status', async () => {
    const ctx = await repo.loadByUserId(userId);
    expect(ctx?.status).toBe('active');
    expect(ctx?.permissionKeys).toContain('orders.read');
  });
});
```

> **DB note:** integration tests need a real Postgres with the migration applied. If no test DB is available in CI yet, keep this file but document running it locally; do NOT block Task 4 commit on it. Unit-level guard tests (Task 7) mock the repository and run without a DB.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS for these new files.

- [ ] **Step 5: Commit**

```bash
git add src/domain/auth/auth-context.ts src/domain/repositories/auth-context.repository.ts src/infrastructure/repositories/prisma-auth-context.repository.ts tests/integration/auth/prisma-auth-context.repository.test.ts
git commit -m "feat(rbac): add auth-context loader (user -> permissions + warehouses)"
```

---

## Task 5: Permission seed-sync + role-permission backfill

**Files:**
- Create: `prisma/rbac-sync.ts`
- Modify: `prisma/seed.ts` (roles block — see Step 3)

This (a) upserts catalog → `permissions` table, marking removed keys deprecated; (b) backfills `RolePermission` rows from the legacy `roles.permissions` JSON (expanding `*` and `resource.*` wildcards) BEFORE the column is dropped.

- [ ] **Step 1: Write the sync script**

```typescript
// prisma/rbac-sync.ts
import { PrismaClient } from '@prisma/client';
import { PERMISSION_CATALOG, PERMISSION_KEYS } from '../src/domain/auth/permission-catalog.js';

const prisma = new PrismaClient();

// Expand a legacy permission token (e.g. "*", "receipts.*", "orders.read") into concrete catalog keys.
function expand(token: string): string[] {
  if (token === '*') return ['system.all'];
  if (token.endsWith('.*')) {
    const resource = token.slice(0, -2);
    return PERMISSION_KEYS.filter((k) => k.startsWith(`${resource}.`));
  }
  return PERMISSION_KEYS.includes(token) ? [token] : [];
}

export async function syncPermissions(): Promise<void> {
  for (const def of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: def.key },
      update: { resource: def.resource, action: def.action, description: def.description, isDeprecated: false },
      create: { key: def.key, resource: def.resource, action: def.action, description: def.description },
    });
  }
  await prisma.permission.updateMany({
    where: { key: { notIn: PERMISSION_KEYS } },
    data: { isDeprecated: true },
  });
}

// Backfill role_permissions from a legacy {roleId -> string[]} map (read before dropping the column).
export async function backfillRolePermissions(legacy: Record<string, string[]>): Promise<void> {
  const perms = await prisma.permission.findMany();
  const idByKey = new Map(perms.map((p) => [p.key, p.id]));
  for (const [roleId, tokens] of Object.entries(legacy)) {
    const keys = new Set(tokens.flatMap(expand));
    for (const key of keys) {
      const permissionId = idByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }
}

if (process.argv[1]?.endsWith('rbac-sync.ts')) {
  syncPermissions().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
}
```

- [ ] **Step 2: Add npm script**

In `package.json` "scripts", add:

```json
"rbac:sync": "tsx prisma/rbac-sync.ts",
```

- [ ] **Step 3: Update seed.ts roles block to use RolePermission**

In `prisma/seed.ts`, replace the four `prisma.role.create({ data: { ..., permissions: [...] } })` calls with role creation that seeds `rolePermissions` via the catalog. Add near the top of `main()` after the UOM block:

```typescript
import { PERMISSION_CATALOG, PERMISSION_KEYS } from '../src/domain/auth/permission-catalog.js';

// inside main(), before clearing data is fine; permissions are reference data:
for (const def of PERMISSION_CATALOG) {
  await prisma.permission.upsert({
    where: { key: def.key },
    update: { resource: def.resource, action: def.action, description: def.description },
    create: { key: def.key, resource: def.resource, action: def.action, description: def.description },
  });
}
const permIdByKey = new Map((await prisma.permission.findMany()).map((p) => [p.key, p.id]));
const connectPerms = (keys: string[]) => ({
  create: keys.map((k) => ({ permissionId: permIdByKey.get(k)! })).filter((c) => c.permissionId),
});
```

Replace the roles array with:

```typescript
const roles = await Promise.all([
  prisma.role.create({ data: { name: 'Admin', description: 'Full system access', roleType: 'admin',
    rolePermissions: connectPerms(['system.all', 'system.all-warehouses']) } }),
  prisma.role.create({ data: { name: 'Warehouse Manager', description: 'Manage warehouse operations', roleType: 'warehouse',
    rolePermissions: connectPerms(PERMISSION_KEYS.filter((k) => /^(receipts|orders|inventory|putaway)\./.test(k))) } }),
  prisma.role.create({ data: { name: 'Picker', description: 'Pick and pack orders', roleType: 'warehouse',
    rolePermissions: connectPerms(['orders.read', 'inventory.read', 'putaway.read', 'putaway.confirm']) } }),
  prisma.role.create({ data: { name: 'Customer Portal', description: 'Customer view only', roleType: 'customer',
    rolePermissions: connectPerms(['orders.read', 'receipts.read', 'inventory.read']) } }),
]);
```

Also add `await prisma.rolePermission.deleteMany();` and `await prisma.permission.deleteMany();` to the clear block is NOT needed (permissions are reference data managed by upsert); only ensure `prisma.role.deleteMany()` cascades RolePermission (it does via `onDelete: Cascade`).

- [ ] **Step 4: Run sync + seed against dev DB**

```bash
npm run prisma:generate
npm run rbac:sync
npm run prisma:seed
```
Expected: catalog rows present in `permissions`; seeded roles have `role_permissions` rows; no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/rbac-sync.ts prisma/seed.ts package.json
git commit -m "feat(rbac): permission seed-sync + role backfill, update seed roles"
```

---

## Task 6: Fix Role entity/repository/use-cases for the new permission model

**Files:**
- Modify: `src/domain/entities/role.entity.ts`
- Modify: `src/domain/repositories/role.repository.ts`
- Modify: `src/infrastructure/repositories/prisma-role.repository.ts`
- Modify: `src/application/use-cases/role/create-role.use-case.ts`, `update-role.use-case.ts`
- Modify: `src/application/dto/` role DTO (Zod schema)
- Test: update `tests/unit/use-cases/` role tests if present

- [ ] **Step 1: Run typecheck to list breakages**

Run: `npm run typecheck`
Expected: errors everywhere `permissions` is referenced on Role (entity, mapper, repo, use-cases, DTO). Record the list.

- [ ] **Step 2: Update the Role entity**

Replace the `permissions: string[]` field on the role entity with `permissionKeys: string[]` (derived from rolePermissions). Example shape:

```typescript
// src/domain/entities/role.entity.ts
export interface Role {
  id: string;
  name: string;
  description: string | null;
  roleType: 'warehouse' | 'customer' | 'admin';
  permissionKeys: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

- [ ] **Step 3: Update the role repository interface + Prisma impl**

The repo must read permissions via the join and write them by replacing `RolePermission` rows. Interface gains nothing new structurally, but `create`/`update` accept `permissionKeys: string[]`. Prisma impl maps `rolePermissions.include.permission.key` on read; on write, resolve keys → permission IDs and `set`/recreate join rows in a transaction:

```typescript
// in prisma-role.repository.ts — read mapping
private toEntity(row: RoleWithPerms): Role {
  return {
    id: row.id, name: row.name, description: row.description,
    roleType: row.roleType, isActive: row.isActive,
    permissionKeys: row.rolePermissions.map((rp) => rp.permission.key),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

// create
async create(data: CreateRoleData): Promise<Role> {
  const perms = await this.prisma.permission.findMany({ where: { key: { in: data.permissionKeys } } });
  const row = await this.prisma.role.create({
    data: {
      name: data.name, description: data.description ?? null, roleType: data.roleType, isActive: data.isActive ?? true,
      rolePermissions: { create: perms.map((p) => ({ permissionId: p.id })) },
    },
    include: { rolePermissions: { include: { permission: true } } },
  });
  return this.toEntity(row);
}

// update — replace join rows atomically
async update(id: string, data: UpdateRoleData): Promise<Role> {
  return this.prisma.$transaction(async (tx) => {
    if (data.permissionKeys) {
      const perms = await tx.permission.findMany({ where: { key: { in: data.permissionKeys } } });
      await tx.rolePermission.deleteMany({ where: { roleId: id } });
      await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: id, permissionId: p.id })) });
    }
    const row = await tx.role.update({
      where: { id },
      data: { name: data.name, description: data.description, roleType: data.roleType, isActive: data.isActive },
      include: { rolePermissions: { include: { permission: true } } },
    });
    return this.toEntity(row);
  });
}
```
(Adjust `CreateRoleData`/`UpdateRoleData`/`RoleWithPerms` types to match existing naming. All `findById`/`findAll` queries must add `include: { rolePermissions: { include: { permission: true } } }`.)

- [ ] **Step 4: Update role DTO (Zod) — validate keys against catalog**

```typescript
// in the role DTO schema file
import { isKnownPermission } from '../../domain/auth/permission-catalog.js';
// permissionKeys: array of known keys
permissionKeys: z.array(z.string().refine(isKnownPermission, { message: 'Unknown permission key' })).default([]),
```
Remove the old `permissions` field from the schema. Update create/update use-cases to pass `permissionKeys` through.

- [ ] **Step 5: Run typecheck + tests**

Run: `npm run typecheck && npm run test -- --run tests/unit`
Expected: typecheck passes; role unit tests pass (update any test asserting old `permissions` to `permissionKeys`).

- [ ] **Step 6: Commit**

```bash
git add src/domain/entities/role.entity.ts src/domain/repositories/role.repository.ts src/infrastructure/repositories/prisma-role.repository.ts src/application src/interfaces tests
git commit -m "feat(rbac): migrate Role to relational permissionKeys"
```

---

## Task 7: requirePermission middleware (+ status enforcement)

**Files:**
- Create: `src/interfaces/http/middlewares/require-permission.middleware.ts`
- Test: `tests/unit/middlewares/require-permission.middleware.test.ts`

The middleware loads `AuthContext` (caches on `req`), enforces `status === 'active'`, then checks the required permission.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/middlewares/require-permission.middleware.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createRequirePermission } from '@interfaces/http/middlewares/require-permission.middleware.js';
import type { AuthContextRepository } from '@domain/repositories/auth-context.repository.js';

function ctx(over = {}) {
  return { userId: 'u1', status: 'active', userType: 'internal', customerId: null, permissionKeys: ['users.read'], warehouseIds: [], ...over };
}
function mkRepo(c: any): AuthContextRepository { return { loadByUserId: vi.fn().mockResolvedValue(c) }; }
function mkReqRes() {
  const req: any = { userId: 'u1' };
  const res: any = {};
  const next = vi.fn();
  return { req, res, next };
}

describe('requirePermission', () => {
  it('passes when permission held', async () => {
    const mw = createRequirePermission(mkRepo(ctx()));
    const { req, res, next } = mkReqRes();
    await mw('users.read')(req, res, next);
    expect(next).toHaveBeenCalledWith();           // no error
    expect(req.authContext).toBeDefined();         // cached
  });

  it('403 when permission missing', async () => {
    const mw = createRequirePermission(mkRepo(ctx()));
    const { req, res, next } = mkReqRes();
    await mw('users.delete')(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err?.statusCode ?? err?.status).toBe(403);
  });

  it('403 when status not active', async () => {
    const mw = createRequirePermission(mkRepo(ctx({ status: 'suspended' })));
    const { req, res, next } = mkReqRes();
    await mw('users.read')(req, res, next);
    const err = next.mock.calls[0][0];
    expect(err?.statusCode ?? err?.status).toBe(403);
  });

  it('system.all bypasses', async () => {
    const mw = createRequirePermission(mkRepo(ctx({ permissionKeys: ['system.all'] })));
    const { req, res, next } = mkReqRes();
    await mw('users.delete')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/middlewares/require-permission.middleware.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Confirm the error classes**

Open `src/shared/errors/app-error.ts`. Confirm there is a `ForbiddenError` (403). If not, add it mirroring `UnauthorizedError`:

```typescript
export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') { super(message, 403); }
}
```

- [ ] **Step 4: Write the middleware**

```typescript
// src/interfaces/http/middlewares/require-permission.middleware.ts
import type { NextFunction, Request, Response } from 'express';

import type { AuthContext } from '../../../domain/auth/auth-context.js';
import type { AuthContextRepository } from '../../../domain/repositories/auth-context.repository.js';
import { makePermissionChecker } from '../../../application/auth/permission-resolver.js';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/app-error.js';

export interface RbacRequest extends Request {
  userId: string;
  authContext?: AuthContext;
}

async function loadContext(repo: AuthContextRepository, req: RbacRequest): Promise<AuthContext> {
  if (req.authContext) return req.authContext;
  const ctx = await repo.loadByUserId(req.userId);
  if (!ctx) throw new UnauthorizedError('User not found');
  if (ctx.status !== 'active') throw new ForbiddenError(`Account ${ctx.status}`);
  req.authContext = ctx;
  return ctx;
}

export function createRequirePermission(repo: AuthContextRepository) {
  return (required: string) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        const ctx = await loadContext(repo, req as RbacRequest);
        const can = makePermissionChecker(ctx.permissionKeys);
        if (!can(required)) throw new ForbiddenError(`Missing permission: ${required}`);
        next();
      } catch (err) {
        next(err);
      }
    };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/middlewares/require-permission.middleware.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/interfaces/http/middlewares/require-permission.middleware.ts src/shared/errors/app-error.ts tests/unit/middlewares/require-permission.middleware.test.ts
git commit -m "feat(rbac): requirePermission middleware with status enforcement"
```

---

## Task 8: requireWarehouseScope middleware

**Files:**
- Create: `src/application/auth/warehouse-scope-resolver.ts`
- Create: `src/interfaces/http/middlewares/require-warehouse-scope.middleware.ts`
- Test: `tests/unit/auth/warehouse-scope-resolver.test.ts`

The resolver computes a user's allowed warehouse set; the middleware compares it against the resource's warehouse id (extracted via a provided accessor).

- [ ] **Step 1: Write the failing resolver test**

```typescript
// tests/unit/auth/warehouse-scope-resolver.test.ts
import { describe, it, expect } from 'vitest';
import { isWarehouseAllowed } from '@application/auth/warehouse-scope-resolver.js';

const base = { userId: 'u', status: 'active' as const, customerId: null, permissionKeys: [] as string[], warehouseIds: ['w1'] };

describe('warehouse scope', () => {
  it('internal user: allowed only for assigned warehouses', () => {
    const ctx = { ...base, userType: 'internal' as const };
    expect(isWarehouseAllowed(ctx, 'w1', ['w1'])).toBe(true);
    expect(isWarehouseAllowed(ctx, 'w2', ['w1'])).toBe(false);
  });

  it('system.all-warehouses bypasses', () => {
    const ctx = { ...base, userType: 'internal' as const, permissionKeys: ['system.all-warehouses'] };
    expect(isWarehouseAllowed(ctx, 'w2', [])).toBe(true);
  });

  it('customer user: allowed via customer warehouse set', () => {
    const ctx = { ...base, userType: 'customer' as const, warehouseIds: [] };
    expect(isWarehouseAllowed(ctx, 'w5', ['w5', 'w6'])).toBe(true);   // customerWarehouseIds passed in
    expect(isWarehouseAllowed(ctx, 'w9', ['w5', 'w6'])).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tests/unit/auth/warehouse-scope-resolver.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the resolver**

```typescript
// src/application/auth/warehouse-scope-resolver.ts
import type { AuthContext } from '../../domain/auth/auth-context.js';
import { SYSTEM_ALL, SYSTEM_ALL_WAREHOUSES } from '../../domain/auth/permission-catalog.js';

// allowedSet: for internal users pass ctx.warehouseIds; for customer users pass the customer's warehouse ids.
export function isWarehouseAllowed(ctx: AuthContext, targetWarehouseId: string, allowedSet: string[]): boolean {
  if (ctx.permissionKeys.includes(SYSTEM_ALL) || ctx.permissionKeys.includes(SYSTEM_ALL_WAREHOUSES)) return true;
  return allowedSet.includes(targetWarehouseId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tests/unit/auth/warehouse-scope-resolver.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the middleware**

This needs the customer→warehouse set for customer users. Add a method to `CustomerWarehouseRepository` if absent: `listWarehouseIdsByCustomer(customerId): Promise<string[]>`. The middleware takes an accessor that pulls the target warehouse id from the request.

```typescript
// src/interfaces/http/middlewares/require-warehouse-scope.middleware.ts
import type { NextFunction, Request, Response } from 'express';

import type { AuthContextRepository } from '../../../domain/repositories/auth-context.repository.js';
import type { CustomerWarehouseRepository } from '../../../domain/repositories/customer-warehouse.repository.js';
import { isWarehouseAllowed } from '../../../application/auth/warehouse-scope-resolver.js';
import { ForbiddenError, UnauthorizedError } from '../../../shared/errors/app-error.js';
import type { RbacRequest } from './require-permission.middleware.js';

type WarehouseIdAccessor = (req: Request) => string | undefined;

export function createRequireWarehouseScope(
  authRepo: AuthContextRepository,
  customerWarehouseRepo: CustomerWarehouseRepository,
) {
  return (getWarehouseId: WarehouseIdAccessor) =>
    async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
      try {
        const r = req as RbacRequest;
        const ctx = r.authContext ?? (await authRepo.loadByUserId(r.userId));
        if (!ctx) throw new UnauthorizedError('User not found');
        if (ctx.status !== 'active') throw new ForbiddenError(`Account ${ctx.status}`);
        r.authContext = ctx;

        const targetId = getWarehouseId(req);
        if (!targetId) throw new ForbiddenError('Warehouse not specified');

        const allowed =
          ctx.userType === 'customer' || ctx.userType === 'external'
            ? ctx.customerId
              ? await customerWarehouseRepo.listWarehouseIdsByCustomer(ctx.customerId)
              : []
            : ctx.warehouseIds;

        if (!isWarehouseAllowed(ctx, targetId, allowed)) throw new ForbiddenError('Warehouse access denied');
        next();
      } catch (err) {
        next(err);
      }
    };
}
```
If `listWarehouseIdsByCustomer` does not exist on the repo, add it to the interface and the Prisma impl:
```typescript
// prisma-customer-warehouse.repository.ts
async listWarehouseIdsByCustomer(customerId: string): Promise<string[]> {
  const rows = await this.prisma.customerWarehouse.findMany({ where: { customerId, isActive: true }, select: { warehouseId: true } });
  return rows.map((r) => r.warehouseId);
}
```

- [ ] **Step 6: Run typecheck + tests**

Run: `npm run typecheck && npm run test -- --run tests/unit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/application/auth/warehouse-scope-resolver.ts src/interfaces/http/middlewares/require-warehouse-scope.middleware.ts src/domain/repositories/customer-warehouse.repository.ts src/infrastructure/repositories/prisma-customer-warehouse.repository.ts tests/unit/auth/warehouse-scope-resolver.test.ts
git commit -m "feat(rbac): requireWarehouseScope middleware + resolver"
```

---

## Task 9: Wire guards into the container and apply to routes

**Files:**
- Modify: `src/main/container.ts`
- Modify: `src/interfaces/http/routes/router.ts` (+ its `Middlewares` type)
- Modify: each route file under `src/interfaces/http/routes/*.routes.ts`

- [ ] **Step 1: Instantiate repos + guard factories in container.ts**

After the existing repository block, add:

```typescript
import { PrismaAuthContextRepository } from '../infrastructure/repositories/prisma-auth-context.repository.js';
import { createRequirePermission } from '../interfaces/http/middlewares/require-permission.middleware.js';
import { createRequireWarehouseScope } from '../interfaces/http/middlewares/require-warehouse-scope.middleware.js';

const authContextRepository = new PrismaAuthContextRepository(prisma);
const requirePermission = createRequirePermission(authContextRepository);
const requireWarehouseScope = createRequireWarehouseScope(authContextRepository, customerWarehouseRepository);
```

Extend the exported `middlewares` object:

```typescript
export const middlewares: Middlewares = {
  authMiddleware,
  requirePermission,
  requireWarehouseScope,
};
```

- [ ] **Step 2: Extend the `Middlewares` type in router.ts**

```typescript
// src/interfaces/http/routes/router.ts
export interface Middlewares {
  authMiddleware: RequestHandler;
  requirePermission: (required: string) => RequestHandler;
  requireWarehouseScope: (getWarehouseId: (req: import('express').Request) => string | undefined) => RequestHandler;
}
```

- [ ] **Step 3: Apply `requirePermission` per route (start with users + roles)**

In `user.routes.ts` (and equivalently `role.routes.ts`), insert the guard between auth and handler. Example:

```typescript
// user.routes.ts — createUserRoutes(controller, middlewares)
router.get('/', middlewares.requirePermission('users.read'), controller.list);
router.post('/', middlewares.requirePermission('users.create'), validate(createUserSchema), controller.create);
router.get('/:id', middlewares.requirePermission('users.read'), controller.getById);
router.patch('/:id', middlewares.requirePermission('users.update'), validate(updateUserSchema), controller.update);
router.delete('/:id', middlewares.requirePermission('users.delete'), controller.delete);
```

Repeat the `resource.action` mapping for every route file using the catalog keys (items→`items.*`, inventory read/update/`inventory.adjust`, receipts incl. `receipts.process`, orders incl. `orders.ship`, returns incl. `returns.process`, putaway `putaway.read`/`putaway.confirm`, etc.). For warehouse-bound resources additionally chain `requireWarehouseScope` where a warehouse id is present in the body/params (e.g. create receipt: `middlewares.requireWarehouseScope((req) => req.body.warehouseId)`).

> Keep this mechanical and exhaustive: every authenticated route gets exactly one `requirePermission`. Routes with no sensible permission (health) stay unguarded.

- [ ] **Step 4: Typecheck + full test + boot smoke**

```bash
npm run typecheck
npm run test -- --run
npm run dev   # boot, hit GET /health (200), GET /users without permission (expect 403), with admin token (200); Ctrl-C
```
Expected: typecheck clean, tests green, manual smoke shows 403 for missing permission and 200 for admin.

- [ ] **Step 5: Commit**

```bash
git add src/main/container.ts src/interfaces/http/routes
git commit -m "feat(rbac): wire guards and enforce permissions on all routes"
```

---

## Task 10: Integration test — enforcement matrix

**Files:**
- Create: `tests/integration/auth/rbac-enforcement.test.ts`

- [ ] **Step 1: Write a supertest matrix** (requires test DB + a way to mint/stub tokens; mirror the existing integration test setup and the JWT stub used elsewhere). Cover: no token → 401; valid token without permission → 403; with permission → 200; suspended user → 403; cross-warehouse access → 403.

```typescript
// tests/integration/auth/rbac-enforcement.test.ts
import { describe, it, expect } from 'vitest';
import request from 'supertest';
// import { createApp } from '@main/app.js'; import { controllers, middlewares } from '@main/container.js';
// Build app, seed a role with only 'users.read', mint a token for that user (reuse existing test JWT helper).
describe.skip('RBAC enforcement matrix (needs test DB + token helper)', () => {
  it('401 without token', async () => { /* request(app).get('/users') -> 401 */ });
  it('403 with insufficient permission', async () => { /* token w/o users.delete -> DELETE 403 */ });
  it('200 with permission', async () => { /* token w/ users.read -> GET 200 */ });
  it('403 when suspended', async () => { /* suspended user -> 403 */ });
});
```
> Marked `describe.skip` until the integration token helper + test DB are confirmed (see DB note in Task 4). Un-skip and fill in once those exist. This is the one place a placeholder is acceptable because it depends on infra decided at execution time — flag it explicitly to the reviewer rather than fake it.

- [ ] **Step 2: Commit**

```bash
git add tests/integration/auth/rbac-enforcement.test.ts
git commit -m "test(rbac): enforcement matrix scaffold (skipped pending test DB)"
```

---

## Self-Review notes (author)

- **Spec coverage:** §4 data model → Task 1; §5 catalog → Task 2; §6 enforcement (permission + scope + status) → Tasks 7, 8, 9; §7 scoping → Tasks 4, 8; JSON→relational migration → Task 5; Role refactor → Task 6. Audit table created (Task 1) but its service/endpoint are Phase 2. Profile/lifecycle/frontend are Phase 2/3 (separate plans).
- **Convention correction:** spec used `resource:action`; existing seed uses `resource.action` + wildcards. Plan adopts dot-notation and expands legacy `*`/`resource.*` in Task 5. Reviewer: confirm this is acceptable.
- **Known infra dependency:** integration tests (Tasks 4, 10) need a real test Postgres + JWT stub helper. Unit tests cover resolvers/middlewares without a DB. Do not block on integration infra; flag it.
- **DB safety:** all migration steps run against dev only; never `prisma:migrate:deploy` to prod unattended.
- **Type consistency check:** `AuthContext`, `makePermissionChecker`, `isWarehouseAllowed`, `RbacRequest`, `ForbiddenError` names are used consistently across Tasks 3–9.
