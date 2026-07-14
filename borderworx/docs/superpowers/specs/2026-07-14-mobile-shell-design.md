# BorderWorx WMS Mobile — Shell (Design Spec)

**Date:** 2026-07-14
**Status:** Approved for planning
**Scope:** First increment — the mobile "shell": login, warehouse selection, and the 4-tile launcher (Receipts, Move, Pick, Lookup). Each menu's deep functionality is a **separate later increment**.

## Goal

A dedicated, mobile-optimized interface for warehouse-floor workers, living inside the existing Next.js app. On login the user lands on a home screen where they pick a warehouse and choose one of four operations. This spec delivers the shell only; the four operations navigate to placeholder stub pages.

## Decisions (locked)

- **Placement:** New `/mobile` URL segment inside the *same* Next.js app. Reuses existing Supabase auth, `backendFetch`, Zod schemas, mappers, and backend endpoints. No separate app, no desktop chrome.
- **Shell data:** Warehouse dropdown loads **live** warehouses from the existing backend and persists the selection. Tile badge counts are **stubbed** (placeholder/zero) and wired per-menu later.
- **Header actions:** Logout (live) and Settings (live, placeholder page) wired now. Hamburger (☰) renders as a no-op placeholder, fleshed out later.
- **Testing:** None in this increment (no unit tests). Manual smoke only.

## Architecture & Routing

New URL segment `/mobile`, split by an internal route group so login stays public while the rest is auth-guarded:

```
src/app/mobile/
├─ layout.tsx              # minimal wrapper (mobile viewport, background) — applies to ALL /mobile/*
├─ login/page.tsx         # /mobile/login  — PUBLIC, mobile-branded sign-in
└─ (app)/                  # route group (adds no URL segment)
   ├─ layout.tsx           # AUTH GUARD + MobileShell (header/footer) + WarehouseProvider
   ├─ page.tsx             # /mobile — warehouse selector + 4 tiles (server component: lists warehouses)
   └─ settings/page.tsx    # /mobile/settings — simple placeholder
```

Stub pages for the four menus (empty "coming soon" placeholders in this increment):

```
src/app/mobile/(app)/receipts/page.tsx   # /mobile/receipts
src/app/mobile/(app)/move/page.tsx        # /mobile/move
src/app/mobile/(app)/pick/page.tsx        # /mobile/pick
src/app/mobile/(app)/lookup/page.tsx      # /mobile/lookup
```

### Middleware

Extend `middleware.ts` so that:
- `/mobile/*` except `/mobile/login` redirects **unauthenticated** users to `/mobile/login` (not the desktop `/login`).
- **Authenticated** users hitting `/mobile/login` are redirected to `/mobile`.

Implementation approach: add mobile-specific branching in the existing middleware alongside the current `isProtectedPath` / `isAuthPath` logic. The existing desktop redirects are unchanged.

### Routes config

Add to `@/shared/config/routes.ts` (no hardcoded path strings anywhere):
- `mobile: '/mobile'`
- `mobileLogin: '/mobile/login'`
- `mobileSettings: '/mobile/settings'`
- `mobileReceipts: '/mobile/receipts'`
- `mobileMove: '/mobile/move'`
- `mobilePick: '/mobile/pick'`
- `mobileLookup: '/mobile/lookup'`

Register the auth-guarded mobile paths so middleware protects them, and ensure `/mobile/login` is treated as a public/auth path (so authenticated users are bounced to `/mobile`).

## Layers & Components

Follows the strict dependency direction `app/ → widgets/ → modules/ → services/ → shared/`. Modules never import other modules — warehouse data is fetched in the server component and passed as props into `modules/mobile` UI.

### widgets/mobile
- `MobileShell.tsx` (client) — header + footer wrapper around page content. Receives `{ name, email }` as props.
- `MobileHeader.tsx` — ☰ (no-op button), "BorderWorx WMS Mobile" title, Settings link (`ROUTES.mobileSettings`), Logout button.
- `MobileFooter.tsx` — centered "Logged in as: {name}" / "{email}".

### modules/mobile
- `ui/MobileLoginForm.tsx` (client) — mobile-branded sign-in. Reuses Supabase `signInWithPassword` (same pattern as existing `LoginForm`). On success: `router.push(ROUTES.mobile)` + `router.refresh()`. Shows error state. Includes BW avatar, "BorderWorx WMS Mobile", "Sign in to your warehouse account", email + password (with show/hide toggle), "Sign In" button.
- `ui/WarehouseSelector.tsx` (client) — dropdown over the warehouse list passed as props. Persists the selected warehouse id to `localStorage` and writes it into the warehouse context. Restores persisted selection on mount; defaults to the first warehouse if none stored.
- `ui/MobileTileGrid.tsx` (client) — 2×2 grid of the four tiles.
- `ui/MobileTile.tsx` — one dark rounded-pill tile: lucide icon + label + optional stubbed count badge; links to its stub route.
- `model/warehouseContext.tsx` — React context + provider holding `{ selectedWarehouseId, setSelectedWarehouseId }` for use by child menus later.
- `model/tiles.ts` — static tile definitions: `{ key, label, icon, href, count? }` for Receipts (Package icon, `mobileReceipts`), Move (Move icon, `mobileMove`), Pick (FileText icon, `mobilePick`), Lookup (Search icon, `mobileLookup`). Counts stubbed/omitted this increment.

### Reused (unchanged)
- `modules/warehouse/api/warehouse.api.ts` → `listWarehouses()`
- `services/auth/requireSession`, `services/auth/getSession` → `getAccessToken()`
- `modules/auth/api/currentUser.api` → `getCurrentUser()`
- `shared/auth` → `AccountStatusScreen` for non-active accounts
- `lucide-react` for icons

## Data Flow

1. **Login:** `/mobile/login` → `MobileLoginForm` → Supabase `signInWithPassword` → cookie set → redirect `/mobile`.
2. **Guard/shell:** `(app)/layout.tsx` (server) → `requireSession()` + `getCurrentUser(accessToken)`. If account not active → render existing `AccountStatusScreen`. Otherwise render `MobileShell` with `{ name, email }` and the page as children, wrapped in `WarehouseProvider`.
3. **Home:** `(app)/page.tsx` (server) → `getAccessToken()` → `listWarehouses()` → passes the warehouse list into `WarehouseSelector`, and renders `MobileTileGrid`.
4. **Selection:** `WarehouseSelector` (client) restores/persists the selected warehouse in `localStorage` and context. Tiles read the selected warehouse (for later use) and navigate to their stub pages on tap.
5. **Logout:** header Logout → Supabase `signOut()` → redirect `/mobile/login`.

## Styling

Tailwind, mobile-first, matching the provided mockups:
- **Login:** centered white card, blue circular "BW" avatar, bold title, muted subtitle, labeled email + password inputs (leading icons, password show/hide eye), full-width blue "Sign In" button.
- **Home:** white top bar (☰ left; title; Settings + Logout right), "Warehouse" label + full-width dropdown, then a 2×2 grid of dark (`slate-600`-ish) rounded-pill tiles, each with centered icon, label, and count line. Centered footer text.

## Out of Scope (deferred to per-menu increments)

- Live badge counts (open receipts, pending picks).
- Actual Receipts / Move / Pick / Lookup functionality.
- Hamburger (☰) drawer contents.
- Any automated tests.
