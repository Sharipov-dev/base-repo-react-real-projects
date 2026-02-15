# Deployment

## Purpose

Document build, deployment, and runtime configuration.

## Build

```bash
npm run build
```

Produces an optimized production build in `.next/`. Validates TypeScript types and ESLint rules during build.

## Development

```bash
npm run dev
```

Starts the Next.js dev server with hot reloading. Reads from `.env.local`.

## Production Start

```bash
npm start
```

Starts the production server from the `.next/` build output.

## Environment Configuration

All deployments require three environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BACKEND_URL`

Set these in the deployment platform's environment configuration (Vercel, Railway, Docker env, etc.).

## Vercel Deployment

1. Connect the repository to Vercel.
2. Set environment variables in Project Settings → Environment Variables.
3. Build command: `npm run build` (default).
4. Output directory: `.next` (default).
5. Framework preset: Next.js (auto-detected).

Middleware runs at the Edge by default on Vercel.

## Docker Deployment

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "start"]
```

Pass environment variables via `docker run -e` or `.env` file.

## Health Check

`GET /api/health` returns:
```json
{ "status": "ok", "timestamp": "2024-01-01T00:00:00.000Z" }
```

Use this for load balancer health checks and deployment readiness probes.

## Key Considerations

- **Middleware** runs on every non-static request. Ensure Supabase URL is accessible from the deployment region.
- **Backend URL** must be reachable from both the server (for SSR) and the client browser (for CSR).
- **CORS** on the custom backend must allow the frontend's deployment domain.
