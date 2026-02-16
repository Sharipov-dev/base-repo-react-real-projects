# Documentation Prompt

The following prompt was used to generate the project's documentation system.

---

```
You are acting as a Senior Frontend Architect and Technical Documentation Engineer.

The project is already implemented using:
- Next.js (App Router)
- TypeScript
- Supabase Authentication
- Custom backend API (JWT via Supabase access_token)
- Structured architecture with:
  - src/app (public/auth/protected route groups)
  - src/modules (domain-driven structure)
  - src/services (supabase, http, auth)
  - src/shared (ui, config, styles)
  - src/widgets

Your task:
Create a professional documentation system inside the project.

DO NOT rewrite business logic.
DO NOT refactor code.
ONLY create documentation files and structure.

1) Create docs/ with:
docs/
  README.md
  architecture/
    overview.md
    folder-structure.md
    routing.md
    auth-flow.md
    backend-integration.md
    data-flow.md
  prompts/
    initial-setup-prompt.md
    architecture-prompt.md
    documentation-prompt.md
  infrastructure/
    environment.md
    deployment.md
    middleware.md
  conventions/
    coding-standards.md
    naming-conventions.md
    module-pattern.md
  decisions/
    adr-001-architecture.md
    adr-002-auth-strategy.md

2) Documentation Requirements:
- Production SaaS quality
- Clear, structured, concise, professional
- Each file includes: Purpose, Responsibilities, Why chosen, Problems solved, Scaling strategy

3) Content for each file (architecture, infrastructure, conventions, decisions)

4) Store prompts in docs/prompts/

5) Create CLAUDE.md at project root:
- Architecture rules
- Folder responsibilities
- Supabase rules
- Backend integration rules
- Code generation constraints
- Performance guidelines
- Token optimization
- How Claude should respond
- How to add new module
- How to add new protected route

6) Quality: Enterprise-grade, not tutorial-style
```
