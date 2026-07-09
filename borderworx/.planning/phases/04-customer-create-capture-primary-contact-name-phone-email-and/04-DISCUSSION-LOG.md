# Phase 4: Customer create — capture Primary Contact (name/phone/email) and auto-create a customer_contacts record when provided - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-09
**Phase:** 04-customer-create-capture-primary-contact-name-phone-email-and
**Areas discussed:** Contact field shape (deep-dived); Auto-create trigger / Atomicity / Scope (defaults accepted)

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Contact field shape | Name split, email requiredness, phone, email prefill | ✓ |
| When to auto-create | What counts as "provided" | (default accepted) |
| Atomicity | Transaction vs best-effort | (default accepted) |
| Scope (UI + edit path) | Full-stack, create-only vs edit path | (default accepted) |

**User's choice:** Discuss "Contact field shape" only; accept sensible defaults for the rest.

---

## Contact Field Shape

### Name capture
| Option | Description | Selected |
|--------|-------------|----------|
| Two fields: First + Last | Separate inputs mapping directly to DB columns; no splitting logic | ✓ |
| Single 'Contact name' | One field split on first space; fragile for multi/single-word names | |

**User's choice:** Two fields: First + Last

### Email requiredness
| Option | Description | Selected |
|--------|-------------|----------|
| Required when creating a contact | name + email mandatory if any contact field filled; honors NOT NULL constraint | ✓ |
| Optional (relax DB) | Allow contact with no email; requires migration | |

**User's choice:** Required when creating a contact

### Phone field
| Option | Description | Selected |
|--------|-------------|----------|
| Single 'Phone' field | Maps to contact.phone; mobile left null | ✓ |
| Both Phone + Mobile | Expose both columns | |

**User's choice:** Single 'Phone' field

### Email source
| Option | Description | Selected |
|--------|-------------|----------|
| Independent fields | Contact email is its own input, no prefill | ✓ |
| Prefill from company email | Default contact email from customer email | |

**User's choice:** Independent fields

---

## Defaults Confirmation

| Option | Description | Selected |
|--------|-------------|----------|
| Looks good — write context | Accept all three defaults as locked | ✓ |
| Adjust atomicity | Switch to best-effort creation | |
| Adjust scope | Include customer edit path | |

**User's choice:** Looks good — write context

## Claude's Discretion

- **Auto-create trigger:** Create the `customer_contacts` row only when first name + last name + email are all present; partial-but-incomplete contact input fails validation; empty contact = no contact created. Row persisted with `isPrimary: true`.
- **Atomicity:** Customer + contact created in a single Prisma `$transaction` (contact failure rolls back the customer), following existing `$transaction` precedent.
- **Scope:** Full-stack, create-only (backend + `CreateCustomerForm.tsx`); customer edit path not touched.

## Deferred Ideas

- Manage/edit the primary contact from the customer **edit** screen — future phase (standalone contact CRUD already covers post-create management).
- Additional contact fields on create (jobTitle, department, mobile, notes) — excluded to keep the create form minimal.
