# IssueLine Project Guide

This guide keeps the detailed setup, deployment, data, and operations notes that used to live in the root README.

## Requirements

- Node.js 24 LTS. The repo pins `v24.16.0` in `.nvmrc`; run `nvm use` if you have nvm installed.
- Supabase account with an active project.

On Windows PowerShell, if `npm` is blocked by the local execution policy, use `npm.cmd ...` (for example `npm.cmd run dev:all`) or allow local scripts for your user with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## Quick Start

```bash
npm install
npm --prefix ui install
npm --prefix backend install
npm run dev:all
```

## Run Locally

Use these commands from the repository root:

```bash
# Development mode (frontend with HMR)
npm run dev

# Development mode (frontend + backend together)
npm run dev:all

# Alias to start the app locally (currently maps to dev)
npm run start
```

Current behavior of root scripts:

- `npm run dev` runs the frontend dev server (`ui`).
- `npm run dev:all` runs the frontend and backend together.
- `npm run start` is an alias of `npm run dev`.
- `npm run check` runs the project quality gate: UI lint, backend tests, UI tests, and the UI production build.

If you also want to run the backend locally:

```bash
# Backend with auto-reload (nodemon)
npm run backend:dev

# Backend without auto-reload (node)
npm run backend:start
```

## Quality Gate

Before opening a PR or deploying, run:

```bash
npm run check
```

The repository also includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs the same lint, test, and build flow on pull requests and pushes to `main`.

## Deploy: Render Backend + Vercel Frontend

This repo includes:

- `render.yaml` for the backend service (`backend/Dockerfile`, health check `/health`).
- `vercel.json` for the frontend build (`ui/dist`) with SPA rewrites.

### 1. Deploy Backend On Render

1. Push this repo to GitHub.
2. In Render, create a **Blueprint** from the repository. It will detect `render.yaml`.
3. In the created `issueline-backend` service, set secret env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Optional but recommended:
   - `BACKEND_ALLOWED_ORIGINS=https://<your-vercel-domain>`
   - keep `BACKEND_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app`
5. Deploy and copy the backend URL, for example `https://issueline-backend.onrender.com`.

### 2. Deploy Frontend On Vercel

1. Import the same repository in Vercel.
2. Keep root directory as repo root. The included `vercel.json` builds `ui/`.
3. Add frontend env vars in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL=https://<your-render-domain>`
4. Deploy.

### 3. Final CORS Check

After Vercel gives you your final URL, update Render:

- `BACKEND_ALLOWED_ORIGINS=https://<your-final-vercel-domain>`

Redeploy backend once. Your public app should now be fully connected.

The Vite application lives in `ui/`, so every npm/yarn/pnpm command related to the frontend should be executed with `npm --prefix ui <command>`.

## Configure Supabase

1. Copy the contents of `ui/.env.example` into the repo root `.env` file, or create it if it does not exist.
2. Add your project credentials. Vite reads env vars from the root:

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_AVATAR_BUCKET=avatars
```

3. Optional: store `SUPABASE_SERVICE_ROLE_KEY` in the same `.env` for backend/scripts usage.
4. Ensure there is at least one user under **Supabase Auth -> Users** for authentication testing.

### Supabase Schema

The production build expects the Supabase project to be already provisioned with the required tables, RLS policies, Auth settings, and Storage buckets. Local SQL migration files are intentionally not included in the final source delivery.

### Admin-Only Editorial API

Editorial HTTP mutations require a valid Supabase bearer token whose user has `app_metadata.role = "admin"` or an `admin` entry in `app_metadata.roles`. Public reads and the internal CLI scripts remain unchanged.

Assign the role only to trusted accounts. From the Supabase SQL Editor:

```sql
update auth.users
set raw_app_meta_data = jsonb_set(
  coalesce(raw_app_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"',
  true
)
where email = 'your-admin@example.com';
```

Sign out and sign in again after changing `app_metadata` so the frontend session receives a fresh token.

The following HTTP mutations are admin-only:

- `POST /hero-images`
- `PATCH /hero-images/:id`
- `POST /hero-timelines`
- All `POST /gcd/*` endpoints

### `login_audit` Table

Every successful login is recorded in `public.login_audit`. The table and its RLS policies must exist in the target Supabase project.

### Private User Avatars

The account page stores avatars in a private bucket on Supabase Storage.

Required frontend env var:

- `VITE_SUPABASE_AVATAR_BUCKET=avatars`

The target Supabase project must include the private avatar bucket (`public = false`) and the related account metadata policies. Previews use signed URLs.

Account capabilities currently available at `/account`:

- Update display name.
- Upload avatar from local device to private Supabase Storage.
- Delete the current avatar.
- Update password.

Navbar behavior:

- If user has an avatar, the navbar shows the signed avatar image.
- If there is no avatar, the navbar falls back to the default logo.

## Cache Data From The SuperHero API

1. Create a free token at [superheroapi.com](https://superheroapi.com/).
2. Add these variables to the root `.env`:
   - `SUPERHERO_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_BACKEND_URL`, for example `http://localhost:4600`
3. Ensure the target Supabase project includes `public.superheroes`.
4. Execute the local ingestor:

```bash
npm run seed:superheroes
# Optional examples:
#   npm run seed:superheroes -- --ids=1,2,3
#   npm run seed:superheroes -- --search=batman,spider-man
#   npm run seed:superheroes -- --names="Batman,Superman"
```

The script (`ui/scripts/superhero-ingest.mjs`) calls the SuperHero API, normalizes the payload, and upserts the results into `superheroes`. Run it again whenever you want to refresh the cache; `api_id` prevents duplicates.

## Hero Image Backend

Use the Express service in `backend/` to upload and manage hero-specific images stored in Supabase Storage + Postgres metadata.

1. Ensure the root `.env` includes:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - Optional knobs: `HERO_IMAGE_BUCKET=hero-images`, `HERO_IMAGE_MAX_PER_HERO=3`, `HERO_IMAGE_MAX_FILE_SIZE=5242880`, `BACKEND_PORT=4600`, `BACKEND_ALLOWED_ORIGINS=http://localhost:5173`.
2. Create a public Supabase Storage bucket matching `HERO_IMAGE_BUCKET`.
3. Ensure the target Supabase project includes `hero_images`, the related trigger, bucket, and RLS policies.
4. Install backend dependencies: `npm --prefix backend install`.
5. Start the API: `npm --prefix backend run dev`, or `run start` for production.
6. Endpoints, default base URL `http://localhost:4600`:
   - `POST /hero-images` multipart with fields `heroApiId`, `alt`, optional `variant`, plus file field `image`.
   - `GET /hero-images?heroApiId=70&onlyActive=false` to list metadata.
   - `GET /hero-images/:heroApiId` to fetch active images for a single hero.
   - `PATCH /hero-images/:id` to update `alt`, `variant`, or toggle `is_active`.

The backend verifies the hero exists, enforces per-hero quotas, uploads binaries to the configured bucket, and persists metadata in `public.hero_images`.

## Hero Timelines

Visual hero timelines reuse the [Aceternity UI timeline](https://ui.aceternity.com/components/timeline) styles and expect data from the backend.

1. Ensure the target Supabase project includes the hero timeline tables and policies.
2. Seed sample entries manually or through backend ingestion. Each row links to `superheroes.api_id`.
3. Ensure the backend is running (`npm --prefix backend run dev`). The UI reads `VITE_BACKEND_URL` to call it.
4. Use `GET /hero-timelines/:slug`, for example `/hero-timelines/batman`, to retrieve entries for a hero slug.
5. Seed issues either directly in Supabase or through the backend:

```bash
curl -X POST http://localhost:4600/hero-timelines ^
  -H "Authorization: Bearer <admin-access-token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"heroSlug\":\"batman\",\"headline\":\"Joker sighting downtown\",\"summary\":\"Confirmed attack stopped by Batman.\",\"issueDate\":\"2026-03-05\",\"severity\":\"warning\",\"issueCode\":\"BATS-001\"}"
```

Click any hero portrait in the dashboard to open `/heroes/:slug`, where the detailed profile and timeline component live. If a slug is missing, rerun `npm run seed:superheroes` so the ingestor re-slugifies older rows.

Timeline rows use `event_type` to distinguish imported comics (`issue`) from editorial events (`milestone`). The editorial `POST /hero-timelines` endpoint defaults to `milestone`; GCD ingestion writes `issue`. The UI renders editorial milestones exclusively from `event_type`.

## Grand Comics Database Ingestion

To ingest Doctor Strange or any hero issue from the [Grand Comics Database](https://www.comics.org/):

1. Ensure the target Supabase project includes the `hero_issues` cache table and related timeline tables.
2. Ensure your backend `.env` includes working GCD credentials (`GCD_USERNAME`/`GCD_PASSWORD` or `GCD_SESSION_ID`) plus `GCD_ALLOW_MANUAL_SYNC=true` while testing.
3. Start the backend (`npm --prefix backend run dev`).
4. Use the endpoints:
   - `POST /gcd/heroes/:slug/series/:seriesId/sync` fetches issues from a specific GCD series, upserts them into `hero_issues`, and adds timeline rows for new issues. Payload accepts `{ "limit": 50, "startPage": 1 }`.
   - `POST /gcd/heroes/:slug/timeline/refresh-covers` fixes cover URLs and is also used automatically by sync.

Example:

```powershell
curl -X POST http://localhost:4600/gcd/heroes/doctor-strange/series/824/sync -H "Authorization: Bearer <admin-access-token>" -H "Content-Type: application/json" -d "{\"limit\":50,\"startPage\":1}"
```

Repeat the sync call with subsequent pages until GCD reports no more issues. Because the backend writes to Supabase first, the UI and future jobs always read from your database instead of hitting GCD directly.

## GCD Collected Editions Importer

Collected editions are stored in a dedicated table (`collected_editions`) separate from `hero_issues`.

Run importer:

```bash
npm run import:collected-edition
```

The CLI asks for a GCD collected-edition issue identifier, shows normalized metadata, asks you to select the hero, and inserts into Supabase unless a duplicate already exists.

To upload a local cover image to storage and sync `cover_image_url`:

```bash
npm run upload:collected-cover -- --collected-id=<uuid> --file=<local-image-path>
```

To automate multi-page imports without hitting GCD's 20-requests/min limit, use:

```bash
npm --prefix backend run sync:gcd -- doctor-strange 824 --batch=12 --delay=65000 --issue-start=131 --issue-end=168
```

Adjust `--batch`, `--delay`, and descriptor bounds (`--issue-start`, `--issue-end`) to control which parts of the series to import. Without descriptor flags, you can still use `--offset`.

## Production Monitoring And Alerts

### Quick Smoke Check After Each Deploy

Use the built-in production verifier right after a Render or Vercel deploy:

```bash
PROD_FRONTEND_URL=https://<your-vercel-domain> \
PROD_BACKEND_URL=https://<your-render-domain> \
npm run verify:prod
```

The script checks:

- `GET <backend>/health` returns `{"status":"ok"}`.
- Backend CORS allows the frontend origin.
- Frontend root returns HTML and contains the SPA root element.

### Minimum Alerts To Configure

1. Render service alerts:
   - Enable notifications for `unhealthy`, `deploy failed`, and `service suspended`.
2. Vercel project alerts:
   - Enable notifications for `deployment failed` and `function errors`.
3. External uptime monitor, recommended:
   - Track `https://<your-vercel-domain>` and `https://<your-render-domain>/health`.
   - Alert by email or Slack if 2+ consecutive checks fail.

### Release Checklist

1. Deploy backend on Render and confirm `/health` is green.
2. Deploy frontend on Vercel and confirm production URL responds.
3. Update `BACKEND_ALLOWED_ORIGINS` in Render with the final Vercel URL if it changed.
4. Run `npm run verify:prod`.
5. Validate one real user flow in browser, such as login and opening one hero detail page.
6. Check logs:
   - Render logs: no repeated `5xx`, CORS errors, or Supabase auth errors.
   - Vercel runtime/build logs: no failed requests for main page load.
7. Mark release complete only when all checks pass.

## Login Flow

- `ui/src/lib/supabaseClient.js` initializes the SDK client with the environment variables.
- `ui/src/App.jsx` handles auth session lifecycle and opens the auth dialog.
- `ui/src/components/AuthDialog.jsx` handles sign-in/sign-up forms.
  - Uses `supabase.auth.signInWithPassword` for authentication.
  - Logs every successful access into `login_audit`.

## Footer

- Global footer is rendered from `ui/src/components/Footer.jsx` and wired in `ui/src/App.jsx`.
- Footer copy/links are centralized in `ui/src/lib/footerConfig.js`.
- Footer is intentionally lightweight and responsive, with:
  - Brand + short product value text.
  - Utility links (`About`, `Feedback`, `Privacy`, `GitHub`).
  - Copyright + data/artwork disclaimer.

## Useful Commands

- `npm run dev`: start the Vite frontend.
- `npm run dev:all`: start frontend and backend together.
- `npm run build`: create a production build.
- `npm run preview`: preview the production build locally.
- `npm run ui:test`: run frontend unit tests with Vitest.
- `npm run ui:test:watch`: run frontend unit tests in watch mode.
- `npm run backend:test`: run backend unit tests.
- `npm run backend:test:coverage`: run backend unit tests with coverage.
- `npm run verify:prod`: smoke-check deployed frontend + backend URLs.
- `npm run import:gcd`: run the guided GCD series importer CLI.
- `npm run import:gcd:issue`: run the guided GCD single-issue importer CLI.
- `npm run import:collected-edition`: run the guided GCD collected-edition importer CLI.
- `npm run upload:collected-cover`: upload a local collected-edition cover and update DB URL.
- `npm --prefix ui run lint`: run ESLint on the frontend.
