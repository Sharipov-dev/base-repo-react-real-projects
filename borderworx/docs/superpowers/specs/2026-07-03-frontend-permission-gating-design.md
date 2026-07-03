# Frontend Permission Gating — Design

**Date:** 2026-07-03
**Status:** Approved (pending spec review)
**Scope pilot:** Organizations table. Rollout to remaining tables follows the same pattern.

## Problem

The backend already enforces RBAC and returns 403 for resources a user's role
cannot access. The frontend, however:

1. **Does not guard routes.** The sidebar hides links a user lacks `<resource>.read`
   for, but navigating directly to the URL (typed, bookmarked, or via a stale link)
   still loads the page. The user then hits backend errors instead of a clear block.
2. **Does not gate the Organizations action controls.** The Create button and the
   Edit/Delete row actions render regardless of `create`/`update`/`delete` permission.
   (Users and Roles tables already gate these; Organizations does not.)

Goal: if a user lacks read permission for a page, they cannot view it (they see an
access-denied screen on the same URL). If they can read but not create/update/delete,
the page and table render but the corresponding action controls do not appear.

## Decisions

- **Denied-read UX:** in-app **Access-Denied screen** on the same URL (consistent with
  the existing `AccountStatusScreen` pattern). No redirect.
- **Enforcement layer:** **server-side**, inside the Next.js App Router `page.tsx`
  (server component). Most secure, no flash of restricted content, fits the existing
  `(protected)/layout.tsx` pattern.
- **Rejected alternative:** `middleware.ts` route→permission checks — middleware lacks
  the `currentUser`/permission context and would need its own token decode + API call,
  duplicating the layout's work and diverging from the server-component pattern.

## Components

### 1. Shared permission predicate — `src/shared/auth/hasPermission.ts`

Extract the `can` logic (currently inline in `usePermissions`) into one pure function
so client hook and server guard agree exactly. `system.all` is the superuser wildcard.

```ts
export const hasPermission = (keys: string[], key: string): boolean =>
  keys.includes('system.all') || keys.includes(key);
```

`usePermissions()` is refactored to delegate to `hasPermission(keys, key)`. No behavior
change; removes duplication before a second consumer (the server guard) is added.

### 2. Cached current-user fetch — `getCurrentUserCached`

Wrap the existing `getCurrentUser(accessToken)` in React `cache()` so the protected
layout and the page share a single `/api/auth/me` request per server render (no double
network call). Lives in **`src/modules/auth/`** (same module as `getCurrentUser`;
`shared/` may not import `services/`/`modules/`, so this cannot live there). The
`(protected)/layout.tsx` is updated to call this cached version too, so the shared cache
is actually hit.

### 3. Access-denied screen — `AccessDeniedScreen`

New **pure presentational** component in `src/shared/auth/`, mirroring `AccountStatusScreen`
(takes no internal dependencies): full-page "You don't have permission to view this page."
Exported from the `@/shared/auth` barrel.

### 4. Route guard — `<RequirePermission permission="...">`

Async server component in **`src/modules/auth/ui/`** (modules may import `services/` and
`shared/`; it needs `getAccessToken` from `services/auth`, `getCurrentUserCached` from its
own module, `hasPermission` + `AccessDeniedScreen` from `shared/auth`). Exported from the
`@/modules/auth` barrel. It is a server component, so it is imported directly into the
server `page.tsx`.

```tsx
export async function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const accessToken = await getAccessToken();
  const user = accessToken ? await getCurrentUserCached(accessToken) : null;
  const allowed = !!user && hasPermission(user.permissionKeys, permission);
  if (!allowed) return <AccessDeniedScreen />;
  return <>{children}</>;
}
```

Children are lazy JSX — when access is denied, the wrapped table never renders or
fetches. Exported from `@/shared/auth`.

### 5. Organizations page — `src/app/(protected)/organizations/page.tsx`

```tsx
export default async function OrganizationsPage() {
  const accessToken = await getAccessToken();
  return (
    <RequirePermission permission="organizations.read">
      <OrganizationTable accessToken={accessToken!} />
    </RequirePermission>
  );
}
```

### 6. Organizations table action gating — `OrganizationTable.tsx`

The component is already `'use client'`; add `const { can } = usePermissions();` and gate:

- **Create button** → render only when `can('organizations.create')`, else `toolbar={undefined}`
  (matches the Roles/Users pattern).
- **Edit row action** → included only when `can('organizations.update')`.
- **Delete row action** → included only when `can('organizations.delete')`.
- **View row action** → always present (page is already read-gated).

```tsx
const rowActions: RowAction<Organization>[] = [
  { label: 'View', icon: <EyeIcon />, onClick: setViewOrg },
  ...(can('organizations.update')
    ? [{ label: 'Edit', icon: <EditIcon />, onClick: setEditOrg } as RowAction<Organization>]
    : []),
  ...(can('organizations.delete')
    ? [{ label: 'Delete', icon: <TrashIcon />, onClick: setDeleteOrg, variant: 'danger' } as RowAction<Organization>]
    : []),
];
```

## Gating map (Organizations)

| Element         | Permission key           |
|-----------------|--------------------------|
| Page / route    | `organizations.read`     |
| Create button   | `organizations.create`   |
| Edit action     | `organizations.update`   |
| Delete action   | `organizations.delete`   |
| View action     | none (read-gated page)   |

## Data flow

1. Request hits `/organizations`.
2. `(protected)/layout.tsx` runs `requireSession()`, fetches `currentUser` via
   `getCurrentUserCached`, blocks non-active accounts (`AccountStatusScreen`).
3. `OrganizationsPage` renders `<RequirePermission permission="organizations.read">`.
4. `RequirePermission` reuses the cached `currentUser` (no second fetch); if the key
   is absent → `AccessDeniedScreen`; otherwise renders `OrganizationTable`.
5. `OrganizationTable` reads `can()` from `usePermissions()` (client context, already
   provided by the layout) and conditionally renders Create/Edit/Delete controls.

## Non-goals

- No change to backend authorization (already enforced).
- No warehouse-scoped permission logic (Phase 2, deferred).
- No centralized frontend permission catalog — keys remain referenced inline by string,
  consistent with the current codebase.

## Rollout after pilot

Each remaining table page becomes: wrap the table in `<RequirePermission permission="<resource>.read">`
in its `page.tsx`, and gate its action controls in the table component via `can()`.
No new infrastructure. Do this only after the Organizations pilot is verified.

## Verification

- User with `organizations.read` only: `/organizations` loads the table; no Create
  button; no Edit/Delete row actions; View works.
- User without `organizations.read`: `/organizations` shows the Access-Denied screen;
  the table never fetches.
- User with full CRUD (or `system.all`): all controls present.
- `npm run build` passes (type check).
