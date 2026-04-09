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
