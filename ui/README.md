# IssueLine UI

Frontend application built with React + Vite.

## Requirements

- Node.js 24 LTS. The repository pins `v24.16.0` in the root `.nvmrc`.

## Run locally

From repository root:

```bash
# Frontend dev server
npm run dev

# Frontend + backend together
npm run dev:all

# Root start command (currently alias of dev)
npm run start
```

From inside `ui/`:

```bash
npm run dev
```

Use `npm run dev` for frontend-only day-to-day development (HMR). Use `npm run dev:all` when the UI needs the local backend too. `npm run start` is provided at root level and currently maps to the same frontend dev flow.

## Tests

From repository root:

```bash
npm run ui:test
npm run ui:test:watch
```

From inside `ui/`:

```bash
npm run test
npm run test:watch
```

Frontend tests use Vitest with jsdom and Testing Library. The first coverage focuses on timeline view-models and account API helpers, so refactors catch broken ordering, filters, progress derivations, and Supabase wrapper behavior early.
