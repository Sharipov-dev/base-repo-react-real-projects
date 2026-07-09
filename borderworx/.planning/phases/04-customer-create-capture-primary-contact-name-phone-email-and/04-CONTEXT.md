# Phase 4: Customer create — capture Primary Contact (name/phone/email) and auto-create a customer_contacts record when provided - Context

**Gathered:** 2026-07-09
**Status:** Ready for planning

<domain>
## Phase Boundary

At customer-create time, allow the user to optionally capture a **Primary Contact** (first name, last name, phone, email). When contact info is provided, the backend auto-creates a `customer_contacts` row for the new customer, marked `isPrimary: true`, atomically with the customer.

**In scope:**
- Backend: extend the customer-create path (DTO/use-case/controller) to accept an optional primary-contact payload and create the contact alongside the customer.
- Frontend: add a Primary Contact section to `CreateCustomerForm.tsx` (create flow only).

**Out of scope:**
- Editing/managing the primary contact from the customer **edit** screen (deferred — see Deferred Ideas). The existing `customer-contact` CRUD endpoints already cover post-create contact management.
- Any change to the standalone `customer-contact` create/list/update/delete flows.

</domain>

<decisions>
## Implementation Decisions

### Contact Field Shape (discussed)
- **D-01:** Capture the contact name as **two separate inputs — First name and Last name** — mapping directly to `customer_contacts.firstName` / `customer_contacts.lastName`. No single-field splitting logic.
- **D-02:** **Email is required when a contact is being created.** If any Primary Contact field is filled, `firstName` + `lastName` + `email` are all mandatory. Honor the existing `customer_contacts.email` NOT NULL / email-validation constraint — **no DB/schema relaxation**.
- **D-03:** Expose a **single "Phone"** field on the create form, mapped to `customer_contacts.phone`. `mobile` is left null (not exposed on the create form).
- **D-04:** Company email and contact-person email are **independent fields** — the contact email input is its own field with **no prefill** from the customer's `email` field.

### Auto-Create Trigger (Claude's Discretion — default accepted)
- **D-05:** The Primary Contact section is **optional**. The `customer_contacts` row is created **only when the required set (first name + last name + email) is present**. If all contact fields are empty, no contact is created and the customer is created normally. If some contact fields are filled but the required set is incomplete, **validation fails** (block save with a field-level error) rather than silently dropping the contact.
- **D-06:** The auto-created contact is persisted with **`isPrimary: true`** (it is the customer's first/primary contact). The existing `CreateCustomerContactUseCase.unsetPrimaryForCustomer` logic remains valid (no-op for a brand-new customer with no other contacts).

### Atomicity (Claude's Discretion — default accepted)
- **D-07:** Customer + primary-contact creation must be **atomic** — wrap both inserts in a single Prisma `$transaction`. If the contact insert fails, the customer insert **rolls back**. Follow the existing `$transaction` precedent in the repos (receipt, inventory, role, putaway) / `advance-order-status.use-case.ts`.

### Scope (Claude's Discretion — default accepted)
- **D-08:** Deliver **full-stack, create-only**: backend (DTO + use-case + controller wiring) and the `CreateCustomerForm.tsx` UI section. The customer edit path is **not** touched in this phase.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

No external ADRs/specs govern this phase — decisions are captured above. The following existing source files are the authoritative patterns to read and extend:

### Backend — customer create path (to extend)
- `borderworxWMS/src/application/dto/customer.dto.ts` — `createCustomerSchema` (add optional primary-contact fields here or as a nested/companion schema)
- `borderworxWMS/src/application/use-cases/customer/create-customer.use-case.ts` — currently a pure pass-through; the transactional contact creation logic goes here
- `borderworxWMS/src/interfaces/http/controllers/customer.controller.ts` — customer create endpoint wiring
- `borderworxWMS/src/main/container.ts` — dependency wiring for `CreateCustomerUseCase`

### Backend — contact model (the constraints to honor)
- `borderworxWMS/src/application/dto/customer-contact.dto.ts` — `createCustomerContactSchema` (firstName, lastName, email all required; phone/mobile/isPrimary optional)
- `borderworxWMS/src/application/use-cases/customer-contact/create-customer-contact.use-case.ts` — single-primary enforcement via `unsetPrimaryForCustomer`
- `borderworxWMS/src/domain/entities/customer-contact.entity.ts` — `CreateCustomerContactData` shape
- `borderworxWMS/src/infrastructure/repositories/prisma-customer-contact.repository.ts` — contact persistence + `unsetPrimaryForCustomer`

### Transaction precedent (pattern to follow for atomicity)
- `borderworxWMS/src/application/use-cases/order/advance-order-status.use-case.ts` — `$transaction` usage in a use-case
- `borderworxWMS/src/infrastructure/repositories/prisma-receipt.repository.ts` — `$transaction` in a repository

### Frontend — create form (to extend)
- `borderworxWMSFrontend/src/modules/customer/ui/CreateCustomerForm.tsx` — tabbed create form (`basics / receipts / orders / system`); add a Primary Contact section
- `borderworxWMSFrontend/src/modules/customer/model/schema.ts` — frontend create schema (extend to mirror backend contact fields)
- `borderworxWMSFrontend/src/modules/customer/api/customer.api.ts` — `createCustomer` request

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CreateCustomerContactUseCase`: already encapsulates single-primary enforcement; the customer-create flow should reuse its logic/repository rather than duplicating contact-insert code.
- Prisma `$transaction`: established across receipt/inventory/role/putaway repos — atomic multi-write is a solved pattern in this codebase.
- `CreateCustomerForm.tsx` tabbed layout: a Primary Contact section fits naturally under the `basics` tab (or a dedicated tab), reusing the form's existing `FormValues`/`toRequest` pattern.

### Established Patterns
- **Clean/hexagonal layering:** DTO (zod) → use-case → domain repository interface → Prisma repository. New contact-on-create logic belongs in `CreateCustomerUseCase`, not the controller or repository directly.
- **Contact requiredness is a hard DB constraint:** `customer_contacts.email` is NOT NULL and `firstName`/`lastName` are required — decisions D-02/D-05 deliberately avoid a migration by keeping these required when a contact is created.

### Integration Points
- `CreateCustomerUseCase.execute` is the single seam where the customer insert and the (optional) contact insert must be coordinated inside one transaction.
- The controller must accept and validate the extended create payload (customer fields + optional contact fields) via the updated `createCustomerSchema`.
- Frontend `createCustomer` API call payload must carry the optional contact fields to the backend.

</code_context>

<specifics>
## Specific Ideas

- The phase wording "name/phone/email" maps to: First name + Last name (D-01), single Phone (D-03), and Email (D-02) on the contact. `jobTitle`, `department`, `mobile`, and `notes` are **not** captured on the create form (available later via the standalone contact CRUD).

</specifics>

<deferred>
## Deferred Ideas

- **Manage the primary contact from the customer edit screen** — surfacing/editing/replacing the primary contact on the customer edit path. Deferred to a future phase; the existing `customer-contact` CRUD endpoints already allow adding/editing contacts after creation.
- **Additional contact fields on create** (jobTitle, department, mobile, notes) — intentionally excluded from the create form to keep it minimal; can be added via standalone contact management.

</deferred>

---

*Phase: 04-customer-create-capture-primary-contact-name-phone-email-and*
*Context gathered: 2026-07-09*
