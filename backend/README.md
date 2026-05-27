# IssueLine Backend

This directory now follows a feature-first layout so related modules live together. The goal is to keep day-to-day work focused on the hero timeline stack without digging through unrelated files.

## Requirements

- Node.js 24 LTS. The repository pins `v24.16.0` in the root `.nvmrc`.

## Key folders
- `src/config` – environment/bootstrap helpers shared across the server.
- `src/lib` – low-level shared clients (for now just the Supabase service client).
- `src/modules/gcd` – everything that talks to the Grand Comics Database (client, mappers, sync logic, maintenance jobs).
- `src/modules/hero` – hero-centric services such as images, cached issues, and timeline helpers.
- `src/modules/issue-state` – user-specific state tracking helpers.
- `src/middlewares` & `src/routes` – express glue that wires modules to HTTP endpoints.
- `scripts/` – operational scripts that now point at the module folders.

When adding new backend capabilities, prefer creating a module (or adding to an existing module) instead of dropping more files in the root. This keeps imports predictable (`src/modules/<domain>/<file>.js`) and avoids the previous services folder bloat.

## Run locally

From the repository root:

```bash
# Backend development mode (nodemon)
npm run backend:dev

# Backend start mode (plain node process)
npm run backend:start
```

From inside `backend/`:

```bash
npm run dev
npm run start
```

Use `npm run dev` while developing and `npm run start` to run the backend without auto-reload.

## Deploy on Render (backend) + Vercel (frontend)

This backend is ready for container deploys on Render:
- `Dockerfile` builds a production image with `npm ci --omit=dev`.
- The server listens on `PORT` automatically (Render runtime port).
- CORS supports exact origins and wildcard patterns for Vercel preview URLs.

### Required environment variables

Set these in the Render service:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GCD_BASE_URL` (default is `https://www.comics.org`, set it explicitly in production)

### Recommended environment variables

- `BACKEND_ALLOWED_ORIGINS`
  Example: `https://issueline.vercel.app,https://www.issueline.com`
- `BACKEND_ALLOWED_ORIGIN_PATTERNS`
  Example: `https://*.vercel.app`
- `PORT`
  Render injects this automatically.
- `BACKEND_HOST`
  Leave default `0.0.0.0` unless you have a custom network setup.

### Render service settings

- Runtime: Dockerfile (recommended)
- Health check path: `/health`
- Start command: from Dockerfile (`npm start`)
- Region: choose the closest region to Supabase for lower latency

### Frontend (Vercel)

In your Vercel project, set:
- `VITE_BACKEND_URL=https://<your-render-service-domain>`

## Internal GCD import CLI

Use the internal CLI to import a full GCD series into Supabase without creating public endpoints:

```bash
npm run import:gcd
# or from repo root:
npm run import:gcd
```

The CLI prompts:
1. `Enter GCD series ID`
2. `Optional: enter hero slug override (press Enter to auto-resolve)`
3. `Exclude variant-cover items from public timeline? (y/n)`
4. `Are cover images already uploaded to the correct bucket? (y/n)`
5. `Enter cover folder (preferred: relative folder under /covers/<hero-slug>)` (only when answer 4 is `y`)

Optional non-interactive hero override flags:
- `--hero-slug=<slug>`
- `--hero-api-id=<api_id>`
- If one of these flags is provided, the hero override prompt is skipped.

Example:
```bash
npm run import:gcd -- --hero-slug=doctor-strange
```

## Internal GCD single-issue import CLI

Use the single-issue variant when you need to import one issue manually for a selected hero:

```bash
npm run import:gcd:issue
# or from repo root:
npm run import:gcd:issue
```

Interactive flow:
1. Select hero from heroes already stored in `superheroes` (with search option).
2. Enter GCD issue ID (numeric) or full issue URL.
3. Choose whether to include it in the hero timeline immediately.
4. Optionally link cover from `/covers/<hero-slug>/<folder>` (preferred) or legacy `/covers/<folder>`.

Optional flags:
- `--hero-slug=<slug>`
- `--hero-api-id=<api_id>`
- `--issue-id=<gcdIssueId-or-url>`
- `--timeline=y|n`
- `--covers=y|n`
- `--covers-folder=<folder-under-covers>`

Duplicate and re-import behavior:
- The importer checks if `(hero_api_id, gcd_issue_id)` already exists.
- `hero_issues` persistence uses upsert, so re-import updates safely instead of creating duplicates.
- If timeline inclusion is enabled, timeline rows are upserted by `metadata.gcdIssueId`.
- Existing rows are updated when re-importing; no blind duplicate timeline inserts.

### Required env vars

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY`
- `GCD_BASE_URL` (defaults to `https://www.comics.org`)
- Optional when needed by GCD limits: `GCD_USERNAME`/`GCD_PASSWORD` or `GCD_SESSIONID`
- Optional retry controls for importer rate limits:
  - `GCD_MINUTE_RETRY_WAIT_MS` (default `61000`)
  - `GCD_MINUTE_RETRY_MAX` (default `10`)

### Cover folder structure

- Bucket: `issue-images` by default (override with `ISSUE_IMAGE_BUCKET`)
- Prefix: `covers` by default (override with `ISSUE_IMAGE_PREFIX`)
- Preferred structure: `covers/<hero-slug>/<folder>`
- Example: for hero `doctor-strange` and folder `doctor_strange_2018`, importer first scans `covers/doctor-strange/doctor_strange_2018`
- Backward compatibility: if no files are found, importer falls back to legacy `covers/<folder>`

### Doctor Strange migration SQL

To migrate existing Doctor Strange cover paths to hero-scoped folders:

- [20260419_doctor_strange_cover_paths.sql](c:\Users\danil\OneDrive\Desktop\IssueLine\supabase\sql\20260419_doctor_strange_cover_paths.sql)

### Deterministic cover matching

The importer matches covers in this order:
1. filename token that looks like a GCD issue id (preferred)
2. normalized issue number token fallback

If multiple files match the same issue, the CLI picks the lexicographically first path, reports it as ambiguous, and continues.
If no file matches, it reports the issue in `missing covers` and continues.

### Rate-limit behavior

When GCD minute limit is reached during import, the importer automatically waits and retries the same request, then continues from where it stopped.
Daily hard-limit errors still abort the run.

### Re-import behavior

- `hero_issues` rows are upserted by `(hero_api_id, gcd_issue_id)`.
- Timeline rows are upserted by `metadata.gcdIssueId` for the same hero.
- When variant exclusion is enabled, duplicate/variant timeline rows are filtered from the canonical timeline and deleted from `hero_timelines` (source issue data remains in `hero_issues` for audit fidelity).

## Internal GCD collected-edition import CLI

Use this CLI when importing one collected edition (omnibus/tpb/hardcover) from GCD into the dedicated `collected_editions` table:

```bash
npm run import:collected-edition
# or from repo root:
npm run import:collected-edition
```

Interactive flow:
1. Enter GCD issue identifier (numeric id or `/issue/<id>/` URL).
2. The importer fetches and normalizes the GCD payload.
3. It prints the candidate metadata (title, series, dates, format, identifiers, cover URL, etc.).
4. Select hero from Supabase heroes (search + pick by number).
5. Confirm insertion.

Duplicate handling:
- The importer checks `collected_editions` before insert.
- Match strategy: `source_external_id` (GCD issue id) and fallback `isbn` when present.
- A matching row is shown and insertion is skipped.

Data model:
- `collected_editions` is intentionally separate from `hero_issues`.
- `collected_edition_issue_links` is created for future manual linking to contained single issues (not used by this first CLI version).
- Apply migration: `supabase/sql/20260420_collected_editions.sql`

### Linking collected editions to single issues (manual CLI)

Use this CLI to create rows in `collected_edition_issue_links`:

```bash
npm run link:collected-edition-issues
```

It supports:
- collected-edition selection by title search
- link mode `gcd` (exact `gcd_issue_id`) or `number` (issue numbers, conservative and ambiguity-safe)
- optional series filtering for `number` mode, so ranges like `1-18` target one specific series/run
- annual/special series are hidden by default in the interactive series picker; type `a` to show them
- list/range selectors like `17779,17780,18000-18005` or `110-111,114-146`

Optional flags:
- `--collected-id=<uuid>`
- `--mode=gcd|number`
- `--issues=<selector>`
- `--series-id=<gcd-series-id>` for exact series filtering in `number` mode
- `--series=<series-name>` for exact title filtering in `number` mode
- `--note=<text>`

Example:

```bash
npm run link:collected-edition-issues -- --collected-id=<uuid> --mode=number --series-id=12345 --issues=1-18
```

### Upload collected-edition cover to storage

Upload a local image to the `collected-edition-images` bucket and update `collected_editions.cover_image_url`:

```bash
npm run upload:collected-cover -- --collected-id=<uuid> --file=<local-image-path>
```

Optional flags:
- `--bucket=<bucket-name>` (default: `collected-edition-images`)
- `--prefix=<folder-prefix>` (default: `covers`)
- `--no-overwrite` (fails if file already exists)

Env knobs:
- `COLLECTED_EDITION_IMAGE_BUCKET`
- `COLLECTED_EDITION_IMAGE_PREFIX`

## Tests

Run backend unit tests from the repository root with:

```bash
npm run backend:test
```

Run backend tests with coverage from the repository root with:

```bash
npm run backend:test:coverage
```

From inside `backend/`, run:

```bash
npm run test
```

Coverage:

```bash
npm run test:coverage
```

The backend test script targets `test/**/*.test.js`, which is compatible with Node 24's built-in test runner.
