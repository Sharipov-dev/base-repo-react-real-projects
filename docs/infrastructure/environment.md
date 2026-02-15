# Environment Variables

## Purpose

Document required environment variables, their validation, and how they're consumed.

## Required Variables

| Variable | Visibility | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anonymous/public key |
| `NEXT_PUBLIC_BACKEND_URL` | Client + Server | Custom backend API base URL |

## `.env.local`

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BACKEND_URL=http://localhost:4000
```

## Validation

`src/shared/config/env.ts` validates all environment variables at application startup using Zod:

```typescript
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_BACKEND_URL: z.string().url(),
});
```

If validation fails, the application throws immediately with a descriptive error. This prevents runtime failures from missing or malformed configuration.

## Usage

Always import from `env.ts`, never read `process.env` directly:

```typescript
import { env } from '@/shared/config/env';
env.NEXT_PUBLIC_BACKEND_URL  // typed, validated
```

## Adding a New Variable

1. Add the variable to `.env.local`.
2. Add it to the Zod schema in `src/shared/config/env.ts`.
3. Import from `env` where needed.
4. Update this documentation.

## Security Notes

- `NEXT_PUBLIC_` prefix means the variable is bundled into client-side JavaScript. Only use this prefix for values safe to expose publicly.
- Supabase anon key is designed to be public. Row Level Security (RLS) on Supabase protects data.
- Server-only secrets (e.g., `SUPABASE_SERVICE_ROLE_KEY`) must NOT have the `NEXT_PUBLIC_` prefix.
