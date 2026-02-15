# ADR-001: Layered Architecture with Domain Modules

## Status

Accepted

## Context

The project needs a frontend architecture that:
- Scales with team size and feature count.
- Separates infrastructure concerns from business logic.
- Supports Next.js App Router conventions.
- Prevents structural drift as the codebase grows.

## Decision

Adopt a layered architecture with five primary layers:

1. **`app/`** — Routing layer. Pages, layouts, and API route handlers.
2. **`widgets/`** — Composition layer. Layout-level blocks (Header, Sidebar, PageShell).
3. **`modules/`** — Domain layer. Self-contained business domains with standardized internal structure.
4. **`services/`** — Infrastructure layer. External service clients, auth utilities, fetch wrappers.
5. **`shared/`** — Cross-cutting layer. Generic UI components, config, hooks, utilities.

Each module follows a fixed structure: `api/`, `model/`, `ui/`, `lib/`, `index.ts`.

## Alternatives Considered

### Feature-based flat structure
```
features/auth/
features/user/
features/dashboard/
```
Rejected. Mixes domain logic with routing concerns. "dashboard" is a page, not a domain.

### FSD (Feature-Sliced Design)
Considered but over-constraining for a project at this scale. The current approach borrows FSD's layering concept while remaining simpler.

### Monolithic `app/` with colocated logic
Rejected. Colocating API calls and types inside `app/` pages couples routing to domain logic and makes refactoring expensive.

## Consequences

**Positive:**
- Clear placement rules for every file type.
- Modules can evolve independently.
- Infrastructure changes don't ripple into domain code.
- New team members can find files predictably.

**Negative:**
- More directories than a minimal project needs initially.
- Barrel exports (`index.ts`) add a small maintenance burden.
- Cross-module sharing requires routing through `shared/`.

## Compliance

New code must follow the layer placement rules documented in [folder-structure.md](../architecture/folder-structure.md).
