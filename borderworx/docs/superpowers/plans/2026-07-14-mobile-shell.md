# BorderWorx WMS Mobile Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the mobile "shell" — a mobile-branded login, an auth-guarded `/mobile` home with a live warehouse selector and a 2×2 launcher of four tiles (Receipts, Move, Pick, Lookup) that navigate to placeholder stub pages.

**Architecture:** A new `/mobile` URL segment inside the existing Next.js app. A minimal `mobile/layout.tsx` applies to all `/mobile/*`; a public `mobile/login` sits outside an internal `(app)` route group whose layout enforces auth and renders the mobile shell (header/footer + warehouse context). Warehouse data is fetched in a server component and passed as props into `modules/mobile` UI. Middleware routes unauthenticated `/mobile/*` to `/mobile/login`.

**Tech Stack:** Next.js 15 App Router, TypeScript (strict), Tailwind CSS, Supabase Auth (`@/services/supabase/client`), `lucide-react` icons, existing `backendFetch` + `modules/warehouse`.

## Global Constraints

Copied from `borderworxWMSFrontend/CLAUDE.md` — every task must honor these:

- Server Components by default. Only add `'use client'` when interactivity is required.
- All imports use the `@/` path alias. No relative traversals like `../../`. (Intra-module relative imports such as `../model/x` are used by the existing code and are fine.)
- No `any` types. No `as Type` assertions on API data. Validate external data with Zod.
- No `console.log` in production code.
- All route paths come from `@/shared/config/routes.ts`. No hardcoded path strings in components/pages.
- All backend calls go through `backendFetch` / existing module APIs. No raw `fetch` to the backend.
- Do not refactor surrounding code or add features beyond what is requested.
- **No tests in this increment.** Per-task verification uses `npx tsc --noEmit` + `npm run lint`, plus a manual dev-server check where noted.

**All commands run from `borderworxWMSFrontend/`** (dev server is `npm run dev` on port 3001).

---

### Task 1: Routes + middleware foundation

**Files:**
- Modify: `src/shared/config/routes.ts` (add mobile route constants)
- Modify: `middleware.ts` (add mobile-area auth branching)

**Interfaces:**
- Produces: `ROUTES.mobile`, `ROUTES.mobileLogin`, `ROUTES.mobileSettings`, `ROUTES.mobileReceipts`, `ROUTES.mobileMove`, `ROUTES.mobilePick`, `ROUTES.mobileLookup` (all `string`). Consumed by every later task.

- [ ] **Step 1: Add mobile routes to `routes.ts`**

In `src/shared/config/routes.ts`, inside the `ROUTES` object, immediately before the `} as const;` that closes it (right after the `users`/`usersNew` lines), add:

```ts
  // Mobile
  mobile: '/mobile',
  mobileLogin: '/mobile/login',
  mobileSettings: '/mobile/settings',
  mobileReceipts: '/mobile/receipts',
  mobileMove: '/mobile/move',
  mobilePick: '/mobile/pick',
  mobileLookup: '/mobile/lookup',
```

Do **not** add these to `PROTECTED_PATHS` or `AUTH_ROUTES` — the mobile area is guarded explicitly in middleware (next step) so it redirects to the mobile login, not the desktop login.

- [ ] **Step 2: Add mobile branching to `middleware.ts`**

In `middleware.ts`, inside `export async function middleware(request)`, after the line `const { pathname } = request.nextUrl;` and **before** the existing `// Authenticated user trying to access auth pages` block, insert:

```ts
  // Mobile area has its own login; guard it explicitly and return early so the
  // desktop redirects below never apply to /mobile/*.
  const isMobileLogin = pathname === ROUTES.mobileLogin;
  const isMobileArea = pathname === ROUTES.mobile || pathname.startsWith('/mobile/');
  if (isMobileArea) {
    if (user && isMobileLogin) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.mobile;
      return NextResponse.redirect(url);
    }
    if (!user && !isMobileLogin) {
      const url = request.nextUrl.clone();
      url.pathname = ROUTES.mobileLogin;
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }
```

`ROUTES` and `NextResponse` are already imported in `middleware.ts`; no new imports needed.

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors introduced by these files.

- [ ] **Step 4: Commit**

```bash
git add src/shared/config/routes.ts middleware.ts
git commit -m "feat(mobile): add mobile routes and middleware auth branching"
```

---

### Task 2: Mobile layout + login page + login form

**Files:**
- Create: `src/app/mobile/layout.tsx`
- Create: `src/app/mobile/login/page.tsx`
- Create: `src/modules/mobile/ui/MobileLoginForm.tsx`

**Interfaces:**
- Consumes: `ROUTES.mobile` (Task 1), `createClient` from `@/services/supabase/client`.
- Produces: `MobileLoginForm` (default-styled sign-in component, no props) at `@/modules/mobile/ui/MobileLoginForm`.

- [ ] **Step 1: Create the minimal mobile layout**

`src/app/mobile/layout.tsx`:

```tsx
import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Create the login form**

`src/modules/mobile/ui/MobileLoginForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, User, Lock } from 'lucide-react';
import { createClient } from '@/services/supabase/client';
import { ROUTES } from '@/shared/config/routes';

export function MobileLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push(ROUTES.mobile);
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
      <div className="flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white">
          BW
        </div>
        <h1 className="mt-4 text-2xl font-bold text-gray-900">BorderWorx WMS Mobile</h1>
        <p className="mt-1 text-gray-500">Sign in to your warehouse account</p>
      </div>

      <form
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSignIn();
        }}
      >
        <div>
          <label htmlFor="email" className="block text-base font-medium text-gray-900">
            Email
          </label>
          <div className="relative mt-1">
            <User className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-3 text-base focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-base font-medium text-gray-900">
            Password
          </label>
          <div className="relative mt-1">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-10 pr-10 text-base focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full rounded-lg bg-blue-500 py-3 text-lg font-medium text-white hover:bg-blue-600 disabled:opacity-50"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Create the login page**

`src/app/mobile/login/page.tsx`:

```tsx
import { MobileLoginForm } from '@/modules/mobile/ui/MobileLoginForm';

export default function MobileLoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <MobileLoginForm />
    </div>
  );
}
```

- [ ] **Step 4: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual check**

Run `npm run dev`, open `http://localhost:3001/mobile/login`. Expected: mobile login card renders (BW avatar, title, email/password with show/hide eye, blue Sign In). Signing in with valid credentials redirects to `/mobile` (which 404s until Task 4 — that's expected mid-plan). Signing in while already authenticated and visiting `/mobile/login` should bounce to `/mobile`.

- [ ] **Step 6: Commit**

```bash
git add src/app/mobile/layout.tsx src/app/mobile/login/page.tsx src/modules/mobile/ui/MobileLoginForm.tsx
git commit -m "feat(mobile): add mobile login page and form"
```

---

### Task 3: Warehouse context + shell widgets + guarded layout

**Files:**
- Create: `src/modules/mobile/model/warehouseContext.tsx`
- Create: `src/widgets/mobile/MobileHeader.tsx`
- Create: `src/widgets/mobile/MobileFooter.tsx`
- Create: `src/widgets/mobile/MobileShell.tsx`
- Create: `src/app/mobile/(app)/layout.tsx`

**Interfaces:**
- Consumes: `requireSession`, `getAccessToken`, `getCurrentUser`, `AccountStatusScreen`, `createClient`, `ROUTES`.
- Produces:
  - `WarehouseProvider` (wraps children) and `useWarehouse(): { selectedWarehouseId: string | null; setSelectedWarehouseId: (id: string) => void }` at `@/modules/mobile/model/warehouseContext` — consumed by Task 4's `WarehouseSelector`.
  - `MobileShell` (props `{ name: string; email: string; children: React.ReactNode }`) at `@/widgets/mobile/MobileShell`.

- [ ] **Step 1: Create the warehouse context**

`src/modules/mobile/model/warehouseContext.tsx`:

```tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

interface WarehouseContextValue {
  selectedWarehouseId: string | null;
  setSelectedWarehouseId: (id: string) => void;
}

const WarehouseContext = createContext<WarehouseContextValue | null>(null);

export function WarehouseProvider({ children }: { children: ReactNode }) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  return (
    <WarehouseContext.Provider value={{ selectedWarehouseId, setSelectedWarehouseId }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse(): WarehouseContextValue {
  const ctx = useContext(WarehouseContext);
  if (!ctx) {
    throw new Error('useWarehouse must be used within WarehouseProvider');
  }
  return ctx;
}
```

- [ ] **Step 2: Create the header**

`src/widgets/mobile/MobileHeader.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { createClient } from '@/services/supabase/client';
import { ROUTES } from '@/shared/config/routes';

export function MobileHeader() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(ROUTES.mobileLogin);
    router.refresh();
  }

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <button type="button" aria-label="Menu" className="text-gray-700">
          <Menu className="h-6 w-6" />
        </button>
        <span className="text-lg font-bold text-gray-900">BorderWorx WMS Mobile</span>
      </div>
      <div className="flex items-center gap-4 text-gray-600">
        <Link href={ROUTES.mobileSettings} className="text-base">
          Settings
        </Link>
        <button type="button" onClick={handleLogout} className="text-base">
          Logout
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create the footer**

`src/widgets/mobile/MobileFooter.tsx`:

```tsx
interface MobileFooterProps {
  name: string;
  email: string;
}

export function MobileFooter({ name, email }: MobileFooterProps) {
  return (
    <footer className="py-4 text-center">
      <p className="text-sm text-gray-700">Logged in as: {name}</p>
      <p className="text-xs text-gray-500">{email}</p>
    </footer>
  );
}
```

- [ ] **Step 4: Create the shell**

`src/widgets/mobile/MobileShell.tsx`:

```tsx
import { MobileHeader } from './MobileHeader';
import { MobileFooter } from './MobileFooter';

interface MobileShellProps {
  name: string;
  email: string;
  children: React.ReactNode;
}

export function MobileShell({ name, email, children }: MobileShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      <MobileHeader />
      <main className="flex-1">{children}</main>
      <MobileFooter name={name} email={email} />
    </div>
  );
}
```

- [ ] **Step 5: Create the guarded `(app)` layout**

`src/app/mobile/(app)/layout.tsx`:

```tsx
import { requireSession } from '@/services/auth/requireSession';
import { getAccessToken } from '@/services/auth/getSession';
import { getCurrentUser } from '@/modules/auth/api/currentUser.api';
import { AccountStatusScreen, type CurrentUser } from '@/shared/auth';
import { MobileShell } from '@/widgets/mobile/MobileShell';
import { WarehouseProvider } from '@/modules/mobile/model/warehouseContext';

export default async function MobileAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireSession();
  const accessToken = await getAccessToken();

  let currentUser: CurrentUser | null = null;
  try {
    if (accessToken) currentUser = await getCurrentUser(accessToken);
  } catch {
    currentUser = null;
  }

  if (currentUser && currentUser.status !== 'active') {
    return <AccountStatusScreen status={currentUser.status} />;
  }

  const name = currentUser
    ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
    : (user.email ?? 'User');
  const email = currentUser?.email ?? user.email ?? '';

  return (
    <WarehouseProvider>
      <MobileShell name={name} email={email}>
        {children}
      </MobileShell>
    </WarehouseProvider>
  );
}
```

Note: `type CurrentUser` is re-exported from `@/shared/auth` (verified in `src/shared/auth/index.ts`).

- [ ] **Step 6: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. (`/mobile` still 404s because its `page.tsx` arrives in Task 4 — layouts compile without a matching page.)

- [ ] **Step 7: Commit**

```bash
git add src/modules/mobile/model/warehouseContext.tsx src/widgets/mobile/MobileHeader.tsx src/widgets/mobile/MobileFooter.tsx src/widgets/mobile/MobileShell.tsx "src/app/mobile/(app)/layout.tsx"
git commit -m "feat(mobile): add warehouse context, shell widgets, and guarded layout"
```

---

### Task 4: Home page — warehouse selector + tile grid

**Files:**
- Create: `src/modules/mobile/model/tiles.ts`
- Create: `src/modules/mobile/ui/MobileTile.tsx`
- Create: `src/modules/mobile/ui/MobileTileGrid.tsx`
- Create: `src/modules/mobile/ui/WarehouseSelector.tsx`
- Create: `src/app/mobile/(app)/page.tsx`

**Interfaces:**
- Consumes: `useWarehouse` (Task 3), `listWarehouses` from `@/modules/warehouse/api/warehouse.api`, `getAccessToken`, `ROUTES.mobileReceipts/Move/Pick/Lookup`.
- Produces: `MobileTileGrid` (no props), `WarehouseSelector` (props `{ warehouses: { id: string; name: string }[] }`).

- [ ] **Step 1: Create the tile definitions**

`src/modules/mobile/model/tiles.ts`:

```ts
import { Package, Move, FileText, Search, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';

export interface MobileTileDef {
  key: string;
  label: string;
  Icon: LucideIcon;
  href: string;
  count?: number;
}

// Badge counts are intentionally omitted in this increment; they are wired
// per-menu in later increments.
export const MOBILE_TILES: MobileTileDef[] = [
  { key: 'receipts', label: 'Receipts', Icon: Package, href: ROUTES.mobileReceipts },
  { key: 'move', label: 'Move', Icon: Move, href: ROUTES.mobileMove },
  { key: 'pick', label: 'Pick', Icon: FileText, href: ROUTES.mobilePick },
  { key: 'lookup', label: 'Lookup', Icon: Search, href: ROUTES.mobileLookup },
];
```

- [ ] **Step 2: Create the tile**

`src/modules/mobile/ui/MobileTile.tsx`:

```tsx
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

interface MobileTileProps {
  label: string;
  Icon: LucideIcon;
  href: string;
  count?: number;
}

export function MobileTile({ label, Icon, href, count }: MobileTileProps) {
  return (
    <Link
      href={href}
      className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-[2rem] bg-slate-600 text-white shadow-md active:bg-slate-700"
    >
      <Icon className="h-7 w-7" />
      <span className="text-lg font-medium">{label}</span>
      {count !== undefined && <span className="text-sm text-slate-200">({count})</span>}
    </Link>
  );
}
```

- [ ] **Step 3: Create the tile grid**

`src/modules/mobile/ui/MobileTileGrid.tsx`:

```tsx
import { MOBILE_TILES } from '../model/tiles';
import { MobileTile } from './MobileTile';

export function MobileTileGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 p-4">
      {MOBILE_TILES.map((tile) => (
        <MobileTile
          key={tile.key}
          label={tile.label}
          Icon={tile.Icon}
          href={tile.href}
          count={tile.count}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create the warehouse selector**

`src/modules/mobile/ui/WarehouseSelector.tsx`:

```tsx
'use client';

import { useEffect, type ChangeEvent } from 'react';
import { useWarehouse } from '../model/warehouseContext';

const STORAGE_KEY = 'bw.mobile.selectedWarehouseId';

interface WarehouseOption {
  id: string;
  name: string;
}

export function WarehouseSelector({ warehouses }: { warehouses: WarehouseOption[] }) {
  const { selectedWarehouseId, setSelectedWarehouseId } = useWarehouse();

  useEffect(() => {
    if (warehouses.length === 0) return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const valid =
      stored && warehouses.some((w) => w.id === stored) ? stored : warehouses[0].id;
    setSelectedWarehouseId(valid);
  }, [warehouses, setSelectedWarehouseId]);

  function handleChange(e: ChangeEvent<HTMLSelectElement>) {
    const id = e.target.value;
    setSelectedWarehouseId(id);
    window.localStorage.setItem(STORAGE_KEY, id);
  }

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-3">
      <label htmlFor="mobile-warehouse" className="block text-sm text-gray-500">
        Warehouse
      </label>
      <select
        id="mobile-warehouse"
        value={selectedWarehouseId ?? ''}
        onChange={handleChange}
        className="mt-1 w-full rounded-lg border border-gray-300 bg-gray-50 px-4 py-3 text-base text-gray-900 focus:border-blue-500 focus:outline-none"
      >
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 5: Create the home page (server component)**

`src/app/mobile/(app)/page.tsx`:

```tsx
import { getAccessToken } from '@/services/auth/getSession';
import { listWarehouses } from '@/modules/warehouse/api/warehouse.api';
import { WarehouseSelector } from '@/modules/mobile/ui/WarehouseSelector';
import { MobileTileGrid } from '@/modules/mobile/ui/MobileTileGrid';

export default async function MobileHomePage() {
  const accessToken = await getAccessToken();
  const warehouses = accessToken
    ? (await listWarehouses({ pageSize: 100 }, accessToken)).data
    : [];
  const options = warehouses.map((w) => ({ id: w.id, name: w.name }));

  return (
    <div>
      <WarehouseSelector warehouses={options} />
      <MobileTileGrid />
    </div>
  );
}
```

- [ ] **Step 6: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual check**

`npm run dev`, sign in via `/mobile/login`. Expected at `/mobile`: white header (☰, title, Settings, Logout), "Warehouse" dropdown populated with live warehouses, 2×2 dark rounded tiles (Receipts, Move, Pick, Lookup), footer "Logged in as: {name}" + email. Changing the dropdown and reloading keeps the selection (localStorage). Tiles navigate to `/mobile/receipts` etc. (404 until Task 5). Logout returns to `/mobile/login`.

- [ ] **Step 8: Commit**

```bash
git add src/modules/mobile/model/tiles.ts src/modules/mobile/ui/MobileTile.tsx src/modules/mobile/ui/MobileTileGrid.tsx src/modules/mobile/ui/WarehouseSelector.tsx "src/app/mobile/(app)/page.tsx"
git commit -m "feat(mobile): add home page with warehouse selector and tile grid"
```

---

### Task 5: Settings + menu stub pages

**Files:**
- Create: `src/modules/mobile/ui/MobilePlaceholder.tsx`
- Create: `src/app/mobile/(app)/settings/page.tsx`
- Create: `src/app/mobile/(app)/receipts/page.tsx`
- Create: `src/app/mobile/(app)/move/page.tsx`
- Create: `src/app/mobile/(app)/pick/page.tsx`
- Create: `src/app/mobile/(app)/lookup/page.tsx`

**Interfaces:**
- Consumes: `ROUTES.mobile`.
- Produces: `MobilePlaceholder` (props `{ title: string }`).

- [ ] **Step 1: Create the placeholder component**

`src/modules/mobile/ui/MobilePlaceholder.tsx`:

```tsx
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/shared/config/routes';

export function MobilePlaceholder({ title }: { title: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-500">Coming soon.</p>
      <Link href={ROUTES.mobile} className="inline-flex items-center gap-1 text-blue-600">
        <ArrowLeft className="h-4 w-4" /> Back to menu
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Create the five stub pages**

`src/app/mobile/(app)/settings/page.tsx`:

```tsx
import { MobilePlaceholder } from '@/modules/mobile/ui/MobilePlaceholder';

export default function MobileSettingsPage() {
  return <MobilePlaceholder title="Settings" />;
}
```

`src/app/mobile/(app)/receipts/page.tsx`:

```tsx
import { MobilePlaceholder } from '@/modules/mobile/ui/MobilePlaceholder';

export default function MobileReceiptsPage() {
  return <MobilePlaceholder title="Receipts" />;
}
```

`src/app/mobile/(app)/move/page.tsx`:

```tsx
import { MobilePlaceholder } from '@/modules/mobile/ui/MobilePlaceholder';

export default function MobileMovePage() {
  return <MobilePlaceholder title="Move" />;
}
```

`src/app/mobile/(app)/pick/page.tsx`:

```tsx
import { MobilePlaceholder } from '@/modules/mobile/ui/MobilePlaceholder';

export default function MobilePickPage() {
  return <MobilePlaceholder title="Pick" />;
}
```

`src/app/mobile/(app)/lookup/page.tsx`:

```tsx
import { MobilePlaceholder } from '@/modules/mobile/ui/MobilePlaceholder';

export default function MobileLookupPage() {
  return <MobilePlaceholder title="Lookup" />;
}
```

- [ ] **Step 3: Verify types + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 4: Manual check**

`npm run dev`, sign in, from `/mobile` tap each tile and the Settings link. Expected: each renders the shell (header/footer) around a "{Title} / Coming soon / Back to menu" placeholder, and "Back to menu" returns to `/mobile`.

- [ ] **Step 5: Full build sanity**

Run: `npm run build`
Expected: build succeeds with the new `/mobile`, `/mobile/login`, `/mobile/settings`, `/mobile/receipts`, `/mobile/move`, `/mobile/pick`, `/mobile/lookup` routes listed.

- [ ] **Step 6: Commit**

```bash
git add src/modules/mobile/ui/MobilePlaceholder.tsx "src/app/mobile/(app)/settings/page.tsx" "src/app/mobile/(app)/receipts/page.tsx" "src/app/mobile/(app)/move/page.tsx" "src/app/mobile/(app)/pick/page.tsx" "src/app/mobile/(app)/lookup/page.tsx"
git commit -m "feat(mobile): add settings and menu stub pages"
```

---

## Self-Review

**Spec coverage:**
- Placement (`/mobile` in same app, `(app)` group, public login) → Tasks 2–5. ✓
- Middleware redirect to `/mobile/login` → Task 1. ✓
- Routes config constants → Task 1. ✓
- Live warehouse dropdown + `localStorage` persistence → Task 4 (`WarehouseSelector`). ✓
- Stubbed tile counts + navigation to stub pages → Tasks 4–5. ✓
- Logout live, Settings live, ☰ no-op → Task 3 (`MobileHeader`) + Task 5 (settings page). ✓
- Footer "Logged in as {name}/{email}", AccountStatusScreen reuse → Task 3. ✓
- Login form (BW avatar, show/hide password) → Task 2. ✓
- No tests → verification is `tsc`/`lint`/`build` + manual. ✓

**Type consistency:** `useWarehouse` returns `{ selectedWarehouseId, setSelectedWarehouseId }` (Task 3), consumed exactly so in Task 4. `MobileShell` props `{ name, email, children }` produced in Task 3, used in Task 3 layout. `MobileTileDef.Icon` typed `LucideIcon`, matched by `MobileTile` prop. `listWarehouses({ pageSize }, accessToken)` matches the real signature. All `ROUTES.mobile*` constants defined in Task 1. ✓

**Placeholder scan:** No TBD/TODO; every code step contains complete code. The word "placeholder" refers only to intentional stub UI, not missing plan content. ✓
