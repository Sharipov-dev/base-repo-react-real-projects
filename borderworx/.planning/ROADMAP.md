# BorderworxWMS — Roadmap

> The prior `.planning/` tree (Phase 01–02 export rollout, RBAC phase 1) was archived/deleted.
> This roadmap is re-seeded for the User & Roles activation milestone.

## Phase 03: User & Roles — Activation Lifecycle + RBAC Gating

**Status:** Planning
**Goal:** Make the already-built RBAC system actually usable end-to-end: invited users
transition from `pending` → `active` automatically when they set their password, every
user is created with a role, and the frontend respects user status and permissions instead
of surfacing raw `403 Account pending` errors.

**Problem being solved:** Admin invites a user → user accepts invite, sets password, logs
in → but hits "Account pending" on every WMS table. New users are hard-coded to
`status: 'pending'` (`borderworxWMS/src/application/use-cases/user/create-user.use-case.ts:36`)
and **no code path ever flips them to `active`**. The "Account pending" text is the backend
`ForbiddenError(\`Account ${status}\`)` 403 from `require-permission.middleware.ts`, surfaced
raw in the UI. Compounding gaps: `roleId` is optional (an active, role-less user is still 403'd
on everything) and the frontend does zero status/role gating.

**Success criteria:**
- An invited user who sets their password becomes `status: 'active'` without admin intervention.
- Every newly created user has a role assigned (no role-less users).
- An active user with a valid role can load WMS tables (no "Account pending").
- The frontend gates navigation/actions by the current user's permissions and shows a
  graceful "awaiting activation / no access" state instead of raw 403 text.
- Existing RBAC enforcement (`requirePermission`, `requireWarehouseScope`) is preserved and reused.

**Requirements:**
- REQ-RBAC-01 — Backend self-activation endpoint (auth-only, not permission-gated) that flips
  the authenticated user `pending → active`.
- REQ-RBAC-02 — Frontend set-password success calls the activation endpoint before redirect.
- REQ-RBAC-03 — Role is mandatory at user invite/create time (backend DTO + FE form).
- REQ-RBAC-04 — Current-user endpoint (`/me` or `/auth/me`) returning status + permissionKeys.
- REQ-RBAC-05 — Frontend permission gating of sidebar nav and per-row/table actions.
- REQ-RBAC-06 — Graceful pending / no-access UI states; distinct handling of 403 `Account *`.

**Depends on:** (RBAC phase 1 — already merged to main; schema + middleware in place)

**Plans:** 6 plans in 3 waves

Plans:
- [x] 03-01-PLAN.md — Backend auth-only endpoints: POST /api/auth/activate + GET /api/auth/me (REQ-RBAC-01, REQ-RBAC-04) — wave 1
- [x] 03-02-PLAN.md — Backend: make roleId required in createUserSchema (REQ-RBAC-03) — wave 1
- [x] 03-03-PLAN.md — Frontend: set-password success calls activation endpoint (REQ-RBAC-02) — wave 2
- [x] 03-04-PLAN.md — Frontend: current-user provider + can() helper + pending screen + sidebar nav gating (REQ-RBAC-05, REQ-RBAC-06) — wave 2
- [x] 03-05-PLAN.md — Frontend: Users/Roles table action gating + friendly 403 handling (REQ-RBAC-05, REQ-RBAC-06) — wave 3
- [x] 03-06-PLAN.md — Frontend: required role select in create-user form (REQ-RBAC-03) — wave 2

### Phase 4: Customer create: capture Primary Contact (name/phone/email) and auto-create a customer_contacts record when provided

**Goal:** At customer-create time, allow the user to optionally capture a Primary Contact
(first name, last name, phone, email). When the required set (first + last + email) is
provided, the backend creates a `customer_contacts` row (`isPrimary: true`) atomically
with the customer in a single Prisma `$transaction`; when the contact fields are all empty
the customer is created normally; a partial contact is rejected with a validation error.
Full-stack, create-only — the customer edit path is untouched, avoiding any customers-table
schema change.

**Requirements:** (decision-derived — no external REQ IDs)
- D-01 — Two-field contact name (First name + Last name → firstName/lastName).
- D-02 — Contact email required whenever a contact is created (honor existing NOT NULL, no migration).
- D-03 — Single Phone field → contact.phone; mobile not exposed on create.
- D-04 — Contact email is an independent input, no prefill from company email.
- D-05 — Contact section optional: create the row only when first+last+email present; partial → validation error; all-empty → no contact.
- D-06 — Auto-created contact persisted with isPrimary:true.
- D-07 — Customer + contact creation atomic via a single Prisma $transaction (repository-level, receipt-repo precedent).
- D-08 — Full-stack, create-only; edit path untouched.

**Depends on:** Phase 3

**Plans:** 2 plans in 2 waves

Plans:
- [x] 04-01-PLAN.md — Backend: extend createCustomerSchema + CreateCustomerData + atomic $transaction contact creation in prisma-customer.repository (D-01,D-02,D-03,D-05,D-06,D-07) — wave 1
- [x] 04-02-PLAN.md — Frontend: Primary Contact section on CreateCustomerForm + schema/type extension + conditional primaryContact assembly (D-01,D-02,D-03,D-04,D-05,D-08) — wave 2

### Phase 5: Customer Receipts tab: replace the empty 'available after the customer is created' placeholder with the receipt configuration form (available during both create and edit). Renders General Settings (Location Options select, Supplier Options select, Fuel Surcharge Percentage number, Enable suggested putaway checkbox) and Mobile Receiving/SmartScan settings (Receive against ASN, Default quantity=1, Allow move of unconfirmed inventory, Use blind receipts, Display Weight field for receipts checkboxes), matching the provided screenshot; persist these receipt settings with the customer

**Goal:** Customers can configure receipt settings (Location/Supplier enabled toggles, Fuel Surcharge %, suggested putaway, and Mobile Receiving/SmartScan options) on the Receipts tab during both create and edit, persisted per customer in a dedicated CustomerReceiptConfig table.
**Requirements**: TBD (decision-derived — D-01..D-07 in 05-CONTEXT.md)
**Depends on:** Phase 4
**Plans:** 5 plans in 4 waves

Plans:
- [x] 05-01-PLAN.md — Backend: CustomerReceiptConfig model/entity/DTO/repo/use-cases + schema push (mirror PackingSlipConfig) (D-01,D-02,D-03,D-04,D-05,D-06) — wave 1
- [x] 05-02-PLAN.md — Backend: receipt-config controller + routes + DI wiring + build (D-05,D-06,D-07) — wave 2
- [x] 05-03-PLAN.md — Backend: atomic receipt-config persistence at customer-create time ($transaction) (D-06) — wave 2
- [x] 05-04-PLAN.md — Frontend: receipt-config types/schema/API + shared ReceiptSettingsForm component (D-01,D-02,D-03,D-04,D-07) — wave 3
- [ ] 05-05-PLAN.md — Frontend: wire Receipts tab (create) + edit-modal Receipts section (upsert) (D-06,D-07) — wave 4
