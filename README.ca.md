# IssueLine (Català)

## Requisits

- Node.js 20 (si tens `nvm`, executa `nvm use`).
- Compte de Supabase amb projecte actiu.

## Inici ràpid

```bash
npm install
npm run dev
```

## Execució en local

Des de l'arrel del repositori:

```bash
# Frontend en mode desenvolupament (Vite + HMR)
npm run dev

# Àlies d'inici local (actualment apunta a dev)
npm run start
```

Comportament actual dels scripts de l'arrel:
- `npm run dev`: arrenca el frontend (`ui`).
- `npm run start`: és un àlies de `npm run dev`.

Si també vols arrencar el backend en local:

```bash
# Backend amb autorecàrrega (nodemon)
npm run backend:dev

# Backend sense autorecàrrega
npm run backend:start
```

## Deploy: Render (backend) + Vercel (frontend)

El repositori inclou:
- `render.yaml` per al backend (`backend/Dockerfile`, health check `/health`)
- `vercel.json` per al build del frontend (`ui/dist`) amb reescriptures SPA

### 1) Desplegar backend a Render

1. Puja el repo a GitHub.
2. A Render, crea un **Blueprint** des del repositori (`render.yaml`).
3. Configura variables secretes al servei `issueline-backend`:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Opcional però recomanat:
   - `BACKEND_ALLOWED_ORIGINS=https://<domini-vercel>`
   - mantenir `BACKEND_ALLOWED_ORIGIN_PATTERNS=https://*.vercel.app`
5. Desplega i copia la URL del backend.

### 2) Desplegar frontend a Vercel

1. Importa el mateix repositori a Vercel.
2. Mantén la root del projecte al repo root (el `vercel.json` ja construeix `ui/`).
3. Afegeix variables:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_BACKEND_URL=https://<domini-render>`
4. Desplega.

### 3) Validació final de CORS

Quan tinguis la URL final de Vercel:
- actualitza `BACKEND_ALLOWED_ORIGINS` a Render amb aquesta URL
- torna a desplegar el backend

## Configurar Supabase

1. Copia `ui/.env.example` a `.env` a l'arrel del repo.
2. Omple credencials:

```bash
VITE_SUPABASE_URL=https://<projecte>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_SUPABASE_AVATAR_BUCKET=avatars
```

3. (Opcional) afegeix `SUPABASE_SERVICE_ROLE_KEY` al mateix `.env` per scripts/backend.
4. Assegura almenys un usuari a **Supabase Auth > Users**.

## Hero timeline i backend

Per funcionalitats de timeline i imatges:

1. Instal·la dependències backend:
```bash
npm --prefix backend install
```
2. Arrenca backend:
```bash
npm --prefix backend run dev
```
3. El frontend consumeix `VITE_BACKEND_URL` (exemple local: `http://localhost:4600`).

## Comandes útils

- `npm run dev`: arrenca frontend (Vite).
- `npm run start`: àlies de dev (actualment).
- `npm run build`: build de producció frontend.
- `npm run preview`: previsualització del build.
- `npm run backend:dev`: backend en desenvolupament.
- `npm run backend:start`: backend en mode execució.
- `npm run verify:prod`: comprovació ràpida frontend/backend desplegats.
- `npm run seed:superheroes`: omplir cache d'herois.
- `npm run import:gcd`: importador intern GCD (sèrie).
- `npm run import:gcd:issue`: importador intern GCD (issue).
- `npm run import:collected-edition`: importador de recopilatoris.
- `npm run upload:collected-cover`: pujada de portada de recopilatori.

## Notes

- El frontend viu a `ui/`: quan treballis directament aquí, pots usar `npm --prefix ui <comanda>`.
- El backend viu a `backend/` i està preparat per deploy via Docker a Render.
