# Manual d'usuari dels scripts CLI (Català)

Aquest document descriu els scripts CLI principals d'IssueLine, com executar-los i quins paràmetres fan servir.

**Darrera actualització:** 1 de juny de 2026.

**Nota:** document elaborat amb l'ajuda del model Codex 5.3.

## 1. Requisits previs

- Node.js `24`. El repositori fixa `v24.16.0` a `.nvmrc`; si tens `nvm`, executa `nvm use`.
- Dependències instal·lades:
  - Arrel del repo: `npm install`
  - Backend: `npm --prefix backend install`
  - UI (si faràs ingestió de superherois): `npm --prefix ui install`
- Fitxer `.env` a l'arrel amb, com a mínim:
  - `SUPABASE_URL` (o `VITE_SUPABASE_URL`)
  - `SUPABASE_SERVICE_ROLE_KEY`
- Per scripts GCD:
  - `GCD_BASE_URL` (per defecte `https://www.comics.org`)
  - Opcional però recomanat per límits de peticions: `GCD_USERNAME` + `GCD_PASSWORD` o `GCD_SESSIONID`
- Per `sync:gcd` manual:
  - `GCD_ALLOW_MANUAL_SYNC=true`

## 2. Índex ràpid de comandes

Des de l'arrel del repo:

- `npm run seed:superheroes`
- `npm run import:gcd`
- `npm run import:gcd:issue`
- `npm run import:collected-edition`
- `npm run link:collected-edition-issues`
- `npm run upload:collected-cover -- --collected-id=<uuid> --file=<ruta>`
- `npm run verify:prod`
- `npm run supabase:start`
- `npm run supabase:stop`
- `npm run supabase:status`
- `npm run supabase:link -- --project-ref <project-ref>`
- `npm run supabase:migration:new -- descriu_el_canvi`
- `npm run supabase:push:dry`
- `npm run supabase:push`

Comandes avançades (backend):

- `npm --prefix backend run sync:gcd -- <hero-slug> <series-id> [opcions]`
- `npm --prefix backend run link:issue-covers -- [opcions]`

## 3. Scripts de dades de personatges

### 3.1 `seed:superheroes`

Sincronitza personatges des de SuperHero API cap a `public.superheroes`.

Comanda:

```bash
npm run seed:superheroes -- --ids=1,70,100
```

Opcions:

- `--ids=1,2,3` llista d'IDs numèrics.
- `--search=batman,ironman` cerca per termes (afegeix totes les coincidències).
- `--names="Batman,Doctor Strange"` cerca per nom (intent d'encaix exacte).
- `-h`, `--help` mostra ajuda.

Variables necessàries:

- `SUPERHERO_API_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL` (o `VITE_SUPABASE_URL`)

## 4. Scripts d'importació GCD

### 4.1 `import:gcd` (importació de sèrie, interactiu)

Comanda:

```bash
npm run import:gcd
```

També pots preseleccionar heroi:

```bash
npm run import:gcd -- --hero-slug=doctor-strange
npm run import:gcd -- --hero-api-id=122
```

Paràmetres CLI:

- `--hero-slug=<slug>`
- `--hero-api-id=<integer>`

El flux interactiu et demana:

1. ID de sèrie GCD.
2. Override opcional d'slug.
3. Si vols excloure variants de timeline.
4. Si les cobertes ja estan pujades.
5. Carpeta de cobertes (si has respost que sí).

Resultat:

- Upsert a `hero_issues`.
- Inserció/actualització de `hero_timelines`.
- Opcionalment enllaç de cobertes.

### 4.2 `import:gcd:issue` (una sola issue, interactiu o semi-interactiu)

Comanda bàsica:

```bash
npm run import:gcd:issue
```

Exemple totalment preconfigurat:

```bash
npm run import:gcd:issue -- --hero-slug=doctor-strange --issue-id=29379 --timeline=y --covers=n
```

Paràmetres:

- `--hero-slug=<slug>`
- `--hero-api-id=<integer>`
- `--issue-id=<id o URL /issue/<id>/>`
- `--timeline=y|n`
- `--covers=y|n`
- `--covers-folder=<carpeta>`

Regles:

- No es pot combinar `--hero-slug` i `--hero-api-id`.
- `--covers-folder` no es pot usar amb `--covers=false`.

## 5. Scripts de recopilatoris (collected editions)

### 5.1 `import:collected-edition` (interactiu)

Importa un recopilatori GCD a `collected_editions`.

Comanda:

```bash
npm run import:collected-edition
```

Flux:

1. Demana ID/URL GCD de la issue recopilatori.
2. Mostra previsualització normalitzada.
3. Detecta duplicats (`source_external_id` / `isbn`).
4. Et fa seleccionar heroi.
5. Demana confirmació.

### 5.2 `link:collected-edition-issues` (interactiu o amb flags)

Enllaça un recopilatori amb `hero_issues` a `collected_edition_issue_links`.

Comanda interactiva:

```bash
npm run link:collected-edition-issues
```

Exemple amb flags:

```bash
npm run link:collected-edition-issues -- --collected-id=<uuid> --mode=number --issues=110-111,114 --note="Arc principal"
```

Paràmetres:

- `--collected-id=<uuid>`
- `--mode=gcd|number`
- `--issues=<llista i/o rangs>`
- `--note=<text>`

Format de `--issues`:

- Vàlid: `10,11,20-25`
- Invàlid: valors no numèrics o rangs invertits (`25-20`)

### 5.3 `upload:collected-cover` (no interactiu)

Puja una imatge local a Storage i actualitza `cover_image_url`.

Comanda:

```bash
npm run upload:collected-cover -- --collected-id=<uuid> --file=C:\covers\omnibus.jpg
```

Paràmetres:

- `--collected-id=<uuid>` obligatori
- `--file=<ruta-local>` obligatori
- `--bucket=<nom-bucket>` opcional (defecte `collected-edition-images`)
- `--prefix=<prefix>` opcional (defecte `covers`)
- `--no-overwrite` opcional

Restriccions:

- Màxim fitxer: `10 MB`
- Extensions admeses: `jpg`, `jpeg`, `png`, `webp`, `gif`

## 6. Scripts avançats de sincronització

### 6.1 `sync:gcd` (batch manual amb throttling)

Comanda:

```bash
npm --prefix backend run sync:gcd -- doctor-strange 824 --batch=12 --delay=65000
```

Sintaxi:

```text
node ./scripts/gcd-series-sync.mjs <hero-slug> <series-id> [opcions]
```

Opcions:

- `--batch=<n>` issues per lot (defecte `12`)
- `--delay=<ms>` espera entre lots (defecte `65000`)
- `--offset=<n>` inici per índex
- `--issue-start=<num>` descriptor inicial
- `--issue-end=<num>` descriptor final
- `--direct-only` només variants "direct"
- `--include-newsstand` inclou newsstand
- `--skip-newsstand` exclou newsstand (defecte)

Important:

- Necessita `GCD_ALLOW_MANUAL_SYNC=true`.

### 6.2 `link:issue-covers` (normalització de `cover_image_path`)

Dry-run (per defecte):

```bash
npm --prefix backend run link:issue-covers
```

Aplicar canvis:

```bash
npm --prefix backend run link:issue-covers -- --apply --verbose
```

Paràmetres:

- `--apply` o `--commit` aplica updates a DB
- `--verbose` mostra mostra d'updates
- `--bucket=<nom>` (defecte `issue-images`)
- `--prefix=<ruta>` (defecte `covers`)
- `--series=<filtre>` filtra per `series_name`

## 7. Verificació de producció

### 7.1 `verify:prod`

Comanda:

```bash
PROD_FRONTEND_URL=https://<frontend> PROD_BACKEND_URL=https://<backend> npm run verify:prod
```

Comprova:

1. `/health` del backend.
2. CORS backend respecte l'origen frontend.
3. HTML principal del frontend i existència de `id="root"`.

Variables:

- `PROD_FRONTEND_URL` (o `VERCEL_URL`)
- `PROD_BACKEND_URL` (o `VITE_BACKEND_URL`)
- `PROD_TIMEOUT_MS` opcional (defecte `15000`)

## 8. Gestió Supabase local (CLI oficial)

- `npm run supabase:start`
- `npm run supabase:stop`
- `npm run supabase:status`
- `npm run supabase:link -- --project-ref <project-ref>`
- `npm run supabase:migration:new -- descriu_el_canvi`
- `npm run supabase:migrations:list`
- `npm run supabase:push:dry`
- `npm run supabase:push`

## 9. Errors habituals i solucions ràpides

### Error: `Missing required environment variable`

Revisa `.env` i que estiguis executant des de l'arrel del repo.

### Error GCD: límit de peticions

- Augmenta `--delay` a `sync:gcd`.
- Fes lots més petits amb `--batch`.
- Configura credencials/sessió GCD.

### Error: `Use either --hero-slug or --hero-api-id, not both`

Passa només una de les dues opcions.

### Error: `Invalid --issues value`

Usa format numèric vàlid: `10,11,20-25`.

### No s'actualitzen cobertes amb `link:issue-covers`

- Executa amb `--verbose`.
- Revisa `--bucket` i `--prefix`.
- Prova un filtre concret `--series=Doctor Strange`.
- Recorda que sense `--apply` és dry-run.

## 10. Bones pràctiques operatives

- Primer prova sempre en dry-run quan el script ho permet.
- Guarda output de consola de les importacions llargues.
- Fes imports per trams (`--issue-start/--issue-end`) per facilitar retries.
- Després d'importar dades, revisa `/hero-timelines/:slug` i la UI del personatge.
