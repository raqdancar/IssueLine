# Guia del projecte IssueLine

Guia detallada per configurar, executar i desplegar IssueLine.

## Requisits

- Node.js 24 LTS. El repo fixa `v24.16.0` a `.nvmrc`; si tens `nvm`, executa `nvm use`.
- Compte de Supabase amb projecte actiu.

En Windows PowerShell, si `npm` queda bloquejat per la politica d'execucio, usa `npm.cmd ...` o habilita scripts locals amb `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`.

## Inici Rapid

```bash
npm install
npm --prefix ui install
npm --prefix backend install
npm run dev:all
```

## Execucio En Local

Des de l'arrel del repositori:

```bash
npm run dev      # frontend
npm run dev:all  # frontend + backend
npm run start    # alias de dev
```

Si nomes vols arrencar el backend:

```bash
npm run backend:dev
npm run backend:start
```

El frontend llegeix `VITE_BACKEND_URL`, per exemple `http://localhost:4600`.

## Deploy: Render + Vercel

El repositori inclou:

- `render.yaml` per al backend.
- `vercel.json` per construir el frontend de `ui/`.

### Backend A Render

1. Puja el repo a GitHub.
2. A Render, crea un **Blueprint** des del repositori.
3. Configura variables secretes al servei `issueline-backend`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Opcional:
   - `BACKEND_ALLOWED_ORIGINS=https://<domini-vercel>`
   - `BACKEND_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app`
5. Desplega i copia la URL del backend.

### Frontend A Vercel

1. Importa el mateix repositori a Vercel.
2. Mantingues la root del projecte a l'arrel del repo.
3. Afegeix variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL=https://<domini-render>`
4. Desplega.

Quan tinguis la URL final de Vercel, actualitza `BACKEND_ALLOWED_ORIGINS` a Render i torna a desplegar el backend.

## Configurar Supabase

1. Crea o actualitza `.env` a l'arrel del repo.
2. Omple credencials:

```bash
VITE_SUPABASE_URL=https://<projecte>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_AVATAR_BUCKET=avatars
```

3. Opcional: afegeix `SUPABASE_SERVICE_ROLE_KEY` per scripts i backend.
4. Assegura almenys un usuari a **Supabase Auth -> Users**.

El projecte Supabase de desti ha d'incloure taules, politiques RLS, configuracio d'Auth i buckets de Storage.

## Timeline I Backend

Per funcionalitats de timeline, imatges i estats de col.leccio:

```bash
npm --prefix backend install
npm --prefix backend run dev
```

Endpoints principals:

- `GET /health`
- `GET /hero-timelines/:slug`
- `POST /hero-images`
- `PATCH /hero-images/:id`
- `POST /gcd/*`
- `GET/POST/PATCH /issue-states`

Les mutacions editorials requereixen un token de Supabase amb rol admin a `app_metadata`.

## Ingesta De Dades

Comandes principals:

```bash
npm run seed:superheroes
npm run import:gcd
npm run import:gcd:issue
npm run import:collected-edition
npm run upload:collected-cover
```

Els importadors escriuen a Supabase i fan que la UI llegeixi sempre de la base de dades, no directament de les APIs externes.

## Validacio I Operacions

Abans de desplegar:

```bash
npm run check
```

Smoke check de produccio:

```bash
PROD_FRONTEND_URL=https://<domini-vercel> \
PROD_BACKEND_URL=https://<domini-render> \
npm run verify:prod
```

Configura alertes minimes a Render, Vercel i un monitor extern per al frontend i `/health`.

## Comandes Utils

- `npm run dev`: arrenca frontend.
- `npm run dev:all`: arrenca frontend i backend.
- `npm run build`: build de produccio.
- `npm run preview`: previsualitzacio del build.
- `npm run ui:test`: tests del frontend.
- `npm run backend:test`: tests del backend.
- `npm run backend:test:coverage`: tests backend amb coverage.
- `npm run verify:prod`: comprovacio rapida de produccio.
