# Initial Setup Prompt

The following prompt was used to initialize the Next.js project and install core dependencies.

---

```
Create a Next.js project with:
- App Router
- TypeScript (strict)
- Tailwind CSS
- ESLint

Install dependencies:
- @supabase/supabase-js
- @supabase/ssr
- @tanstack/react-query
- zod
- lucide-react
- server-only

Configure:
- Path alias @/ → ./src/*
- .env.local with NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_BACKEND_URL
- Tailwind content paths for src/app, src/modules, src/widgets, src/shared
```
