# IssueLine Backend

This directory now follows a feature-first layout so related modules live together. The goal is to keep day-to-day work focused on the hero timeline stack without digging through unrelated files.

## Key folders
- `src/config` – environment/bootstrap helpers shared across the server.
- `src/lib` – low-level shared clients (for now just the Supabase service client).
- `src/modules/gcd` – everything that talks to the Grand Comics Database (client, mappers, sync logic, maintenance jobs).
- `src/modules/hero` – hero-centric services such as images, cached issues, and timeline helpers.
- `src/modules/issue-state` – user-specific state tracking helpers.
- `src/middlewares` & `src/routes` – express glue that wires modules to HTTP endpoints.
- `scripts/` – operational scripts that now point at the module folders.

When adding new backend capabilities, prefer creating a module (or adding to an existing module) instead of dropping more files in the root. This keeps imports predictable (`src/modules/<domain>/<file>.js`) and avoids the previous services folder bloat.

## Deploy on Koyeb (backend) + Vercel (frontend)

This backend is now ready for container deploys on Koyeb:
- `Dockerfile` builds a production image with `npm ci --omit=dev`.
- The server listens on `PORT` automatically (Koyeb runtime port).
- CORS supports exact origins and wildcard patterns for Vercel preview URLs.

### Required environment variables

Set these in the Koyeb service:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GCD_BASE_URL` (default is `https://www.comics.org`, set it explicitly in production)

### Recommended environment variables

- `BACKEND_ALLOWED_ORIGINS`
  Example: `https://issueline.vercel.app,https://www.issueline.com`
- `BACKEND_ALLOWED_ORIGIN_PATTERNS`
  Example: `https://*.vercel.app`
- `PORT`
  Koyeb injects this automatically.
- `BACKEND_HOST`
  Leave default `0.0.0.0` unless you have a custom network setup.

### Koyeb service settings

- Runtime: Dockerfile (recommended)
- Health check path: `/health`
- Start command: from Dockerfile (`npm start`)
- Region: choose the closest region to Supabase for lower latency

### Frontend (Vercel)

In your Vercel project, set:
- `VITE_BACKEND_URL=https://<your-koyeb-service-domain>`
