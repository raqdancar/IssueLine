# IssueLine

## Requirements

- Node.js 24 LTS. The repo pins `v24.16.0` in `.nvmrc`; run `nvm use` if you have nvm installed.
- Supabase account with an active project.

On Windows PowerShell, if `npm` is blocked by the local execution policy, use `npm.cmd ...` (for example `npm.cmd run dev:all`) or allow local scripts for your user with `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## Quick start

```bash
npm install
npm --prefix ui install
npm --prefix backend install
npm run dev:all
```

## Run locally

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

## Quality gate

Before opening a PR or deploying, run:

```bash
npm run check
```

The repository also includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs the same lint, test, and build flow on pull requests and pushes to `main`.

## Deploy: Render (backend) + Vercel (frontend)

This repo now includes:
- `render.yaml` for the backend service (`backend/Dockerfile`, health check `/health`)
- `vercel.json` for the frontend build (`ui/dist`) with SPA rewrites

### 1) Deploy backend on Render

1. Push this repo to GitHub.
2. In Render, create a **Blueprint** from the repository (it will detect `render.yaml`).
3. In the created `issueline-backend` service, set secret env vars:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Optional but recommended:
   - `BACKEND_ALLOWED_ORIGINS=https://<your-vercel-domain>`
   - keep `BACKEND_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app`
5. Deploy and copy the backend URL, for example:
   - `https://issueline-backend.onrender.com`

### 2) Deploy frontend on Vercel

1. Import the same repository in Vercel.
2. Keep root directory as repo root (the included `vercel.json` builds `ui/`).
3. Add frontend env vars in Vercel:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL=https://<your-render-domain>`
4. Deploy.

### 3) Final CORS check

After Vercel gives you your final URL, update Render:
- `BACKEND_ALLOWED_ORIGINS=https://<your-final-vercel-domain>`

Redeploy backend once. Your public app should now be fully connected.

The Vite application lives in `ui/`, so every npm/yarn/pnpm command related to the frontend should be executed with `npm --prefix ui <command>`.

## Configure Supabase

1. Copy the contents of `ui/.env.example` into the repo root `.env` file (or create it if it doesn't exist).
2. Add your project credentials (Vite now reads env vars from the root):

```bash
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_AVATAR_BUCKET=avatars
```

3. (Optional) Store `SUPABASE_SERVICE_ROLE_KEY` in the same `.env` for backend/scripts usage.
4. Ensure there is at least one user under **Supabase Auth -> Users** for authentication testing.

### Schema migrations

Supabase schema changes are versioned under `supabase/migrations/` and applied through the official CLI flow.

For a new remote project:

```bash
npm run supabase:link -- --project-ref <project-ref>
npm run supabase:push:dry
npm run supabase:push
```

This repository adopted migrations after the existing Supabase project had already been provisioned manually. Run this one-time baseline after linking that existing project so the CLI records the applied history without replaying it:

```bash
npx supabase migration repair --status applied 20260305000000 20260306000000 20260307000000 20260310000000 20260313000000 20260416000000 20260419000000 20260420000000 20260427000000 20260531000000
npm run supabase:migrations:list
```

For each future schema change:

```bash
npm run supabase:migration:new -- describe_the_change
# edit the generated file under supabase/migrations/
npm run supabase:push:dry
npm run supabase:push
```

### Admin-only editorial API

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

### `login_audit` table

Every successful login is recorded in `public.login_audit`.
Schema and RLS are provisioned through `supabase/migrations/`.

### Private user avatars (account page)

The account page stores avatars in a private bucket on Supabase Storage.

Required migration:
- `supabase/migrations/20260416000000_user_avatars.sql`

Required frontend env var:
- `VITE_SUPABASE_AVATAR_BUCKET=avatars`

The bucket remains private (`public = false`), and previews use signed URLs.

Account capabilities currently available at `/account`:
- Update display name.
- Upload avatar from local device to private Supabase Storage.
- Delete the current avatar.
- Update password.

Navbar behavior:
- If user has an avatar, the navbar shows the signed avatar image.
- If there is no avatar, the navbar falls back to the default logo.

## Cache data from the SuperHero API

1. Create a free token at [superheroapi.com](https://superheroapi.com/).
2. Add these variables to the root `.env`:
   - `SUPERHERO_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (write-capable key).
   - `VITE_SUPABASE_URL` (reused by both the UI and scripts now that envs load from the root).
   - `VITE_BACKEND_URL` (e.g. `http://localhost:4600`) so the UI can reach the IssueLine backend.
3. Ensure migrations are applied with `npm run supabase:push` (`public.superheroes`).
4. Execute the local ingestor:

```bash
npm run seed:superheroes
# Optional examples:
#   npm run seed:superheroes -- --ids=1,2,3                # Specific IDs
#   npm run seed:superheroes -- --search=batman,spider-man # Search terms (ingests all matches)
#   npm run seed:superheroes -- --names="Batman,Superman"  # Best effort exact names
```

The script (`ui/scripts/superhero-ingest.mjs`) calls the SuperHero API, normalizes the payload, and upserts the results into `superheroes`. Run it again whenever you want to refresh the cache; `api_id` prevents duplicates.

## Hero image backend

Use the Express service in `backend/` to upload and manage hero-specific images stored in Supabase Storage + Postgres metadata:

1. Ensure the root `.env` includes:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - Optional knobs: `HERO_IMAGE_BUCKET=hero-images`, `HERO_IMAGE_MAX_PER_HERO=3`, `HERO_IMAGE_MAX_FILE_SIZE=5242880`, `BACKEND_PORT=4600`, `BACKEND_ALLOWED_ORIGINS=http://localhost:5173`.
2. Create a public Supabase Storage bucket matching `HERO_IMAGE_BUCKET`.
3. Ensure migrations are applied with `npm run supabase:push` (`hero_images`, trigger, and RLS policies).
4. Install backend dependencies: `npm --prefix backend install`.
5. Start the API: `npm --prefix backend run dev` (or `run start` for production).
6. Endpoints (default base URL `http://localhost:4600`):
   - `POST /hero-images` (multipart) with fields `heroApiId`, `alt`, optional `variant`, plus file field `image`.
   - `GET /hero-images?heroApiId=70&onlyActive=false` to list metadata.
   - `GET /hero-images/:heroApiId` to fetch active images for a single hero.
   - `PATCH /hero-images/:id` to update `alt`, `variant`, or toggle `is_active`.

The backend verifies the hero exists, enforces per-hero quotas, uploads binaries to the configured bucket, and persists metadata in `public.hero_images`.

## Hero timelines

Visual hero timelines reuse the [Aceternity UI timeline](https://ui.aceternity.com/components/timeline) styles and expect data from the backend:

1. Ensure migrations are applied with `npm run supabase:push`.
2. Seed sample entries manually (or wait until the ingest script is ready). Each row links to `superheroes.api_id`.
3. Ensure the backend is running (`npm --prefix backend run dev`). The UI reads `VITE_BACKEND_URL` to call it.
4. Use `GET /hero-timelines/:slug` (e.g. `/hero-timelines/batman`) to retrieve entries for a hero slug.
5. Seed issues either directly in Supabase or through the backend:

```bash
curl -X POST http://localhost:4600/hero-timelines ^
  -H "Authorization: Bearer <admin-access-token>" ^
  -H "Content-Type: application/json" ^
  -d "{\"heroSlug\":\"batman\",\"headline\":\"Joker sighting downtown\",\"summary\":\"Confirmed attack stopped by Batman.\",\"issueDate\":\"2026-03-05\",\"severity\":\"warning\",\"issueCode\":\"BATS-001\"}"
```

Click any hero portrait in the dashboard to open `/heroes/:slug`, where the detailed profile and Aceternity-inspired timeline component now live. If a slug is missing, rerun `npm run seed:superheroes` so the ingestor re-slugifies older rows.

Timeline rows use `event_type` to distinguish imported comics (`issue`) from editorial events (`milestone`). The editorial `POST /hero-timelines` endpoint defaults to `milestone`; GCD ingestion writes `issue`.

## Grand Comics Database ingestion

To ingest every Doctor Strange (or any hero) issue from the [Grand Comics Database](https://www.comics.org/):

1. Ensure migrations are applied with `npm run supabase:push` (`hero_issues` cache table).
2. Ensure your backend `.env` includes working GCD credentials (`GCD_USERNAME`/`GCD_PASSWORD` or `GCD_SESSION_ID`) plus `GCD_ALLOW_MANUAL_SYNC=true` while testing.
3. Start the backend (`npm --prefix backend run dev`).
4. Use the new endpoints:
   - `POST /gcd/heroes/:slug/series/:seriesId/sync` â†’ fetches issues from a specific GCD series, upserts them into `hero_issues`, and adds timeline rows for any new issues. Payload accepts `{ "limit": 50, "startPage": 1 }`.
   - `POST /gcd/heroes/:slug/timeline/refresh-covers` â†’ fixes cover URLs (also used automatically by the sync).
5. Example (Doctor Strange, Strange Tales series #824):

```powershell
curl -X POST http://localhost:4600/gcd/heroes/doctor-strange/series/824/sync -H "Authorization: Bearer <admin-access-token>" -H "Content-Type: application/json" -d "{\"limit\":50,\"startPage\":1}"
```

Repeat the sync call with subsequent pages until GCD reports no more issues. Because the backend writes to Supabase first, the UI and future jobs always read from your database instead of hitting GCD directly.

## GCD collected editions importer (CLI)

Collected editions are stored in a dedicated table (`collected_editions`) separate from `hero_issues`.

Apply migration:
- `supabase/migrations/20260420000000_collected_editions.sql`

Run importer:

```bash
npm run import:collected-edition
```

The CLI asks for a GCD collected-edition issue identifier (numeric id or `/issue/<id>/` URL), shows normalized metadata, asks you to select the hero, and inserts into Supabase unless a duplicate already exists.

To upload a local cover image to storage and sync `cover_image_url`:

```bash
npm run upload:collected-cover -- --collected-id=<uuid> --file=<local-image-path>
```

To automate multi-page imports without hitting GCDâ€™s 20-requests/min limit, use the helper script:

```bash
npm --prefix backend run sync:gcd -- doctor-strange 824 --batch=12 --delay=65000 --issue-start=131 --issue-end=168
```

Adjust `--batch` (issues per request), `--delay` (ms between requests), and the descriptor bounds (`--issue-start`, `--issue-end`) to control which parts of the series to import. Without descriptor flags, you can still fall back to `--offset`.

## Production monitoring and alerts

### Quick smoke check after each deploy

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

### Minimum alerts to configure

1. Render service alerts:
- Enable notifications for `unhealthy`, `deploy failed`, and `service suspended`.
2. Vercel project alerts:
- Enable notifications for `deployment failed` and `function errors`.
3. External uptime monitor (recommended):
- Track `https://<your-vercel-domain>` and `https://<your-render-domain>/health`.
- Alert by email (or Slack) if 2+ consecutive checks fail.

### Release checklist (Render + Vercel)

1. Deploy backend (Render) and confirm `/health` is green.
2. Deploy frontend (Vercel) and confirm production URL responds.
3. Update `BACKEND_ALLOWED_ORIGINS` in Render with the final Vercel URL if it changed.
4. Run `npm run verify:prod`.
5. Validate one real user flow in browser (login and open one hero detail page).
6. Check logs:
- Render logs: no repeated `5xx`, CORS errors, or Supabase auth errors.
- Vercel runtime/build logs: no failed requests for main page load.
7. Mark release complete only when all checks pass.

## Login flow

- `ui/src/lib/supabaseClient.js` initializes the SDK client with the environment variables.
- `ui/src/App.jsx` handles auth session lifecycle and opens the auth dialog.
- `ui/src/components/AuthDialog.jsx` handles sign-in/sign-up forms.
  - Uses `supabase.auth.signInWithPassword` for authentication.
  - Logs every successful access into `login_audit`.

## Footer

- Global footer is rendered from `ui/src/components/Footer.jsx` and wired in `ui/src/App.jsx`.
- Footer copy/links are centralized in `ui/src/lib/footerConfig.js` to keep content reusable and easy to extract for i18n later.
- Footer is intentionally lightweight and responsive, with:
  - Brand + short product value text.
  - Utility links (`About`, `Feedback`, `Privacy`, `GitHub`).
  - Copyright + data/artwork disclaimer.

## Useful commands

- `npm run dev`: start the Vite frontend.
- `npm run dev:all`: start frontend and backend together.
- `npm run build`: create a production build.
- `npm run preview`: preview the production build locally.
- `npm run ui:test`: run frontend unit tests (Vitest).
- `npm run ui:test:watch`: run frontend unit tests in watch mode.
- `npm run backend:test`: run backend unit tests.
- `npm run backend:test:coverage`: run backend unit tests with coverage.
- `npm run verify:prod`: smoke-check deployed frontend + backend URLs.
- `npm run import:gcd`: run the internal guided GCD series importer CLI (backend tool).
- `npm run import:gcd:issue`: run the internal guided GCD single-issue importer CLI (backend tool).
- `npm run import:collected-edition`: run the internal guided GCD collected-edition importer CLI (backend tool).
- `npm run upload:collected-cover`: upload local collected-edition cover and update DB URL (backend tool).
- `npm --prefix ui run lint`: run ESLint on the frontend.

