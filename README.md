# IssueLine

IssueLine is a comic collection and editorial timeline app for tracking issues, collected editions, reading progress, and publishing history.

## Quick Start

```bash
npm install
npm --prefix ui install
npm --prefix backend install
npm run dev:all
```

Frontend: `http://localhost:5173`

Backend health check: `http://localhost:4600/health`

## Requirements

- Node.js 24 LTS. The pinned version is in `.nvmrc`.
- A Supabase project with the required tables, policies, Auth settings, and Storage buckets.
- A root `.env` with Supabase and backend variables. See the full guide below.

On Windows PowerShell, use `npm.cmd ...` if local script execution blocks `npm`.

## Common Commands

```bash
npm run dev          # frontend only
npm run dev:all      # frontend + backend
npm run check        # lint, tests, and UI build
npm run build        # production UI build
```

## Documentation

- [Project guide](docs/project-guide.md)
- [Architecture docs](docs/architecture/README.md)
- [CLI manuals](docs/manuals/manual-cli-ca.md)
- [Backend notes](backend/README.md)
- [Frontend notes](ui/README.md)

## Release

Current major release: `v1.0.0`
