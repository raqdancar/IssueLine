# IssueLine (Catala)

IssueLine es una app per gestionar col.leccions de comics, timelines editorials, recopilatoris i progres de lectura.

## Inici Rapid

```bash
npm install
npm --prefix ui install
npm --prefix backend install
npm run dev:all
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4600/health`

## Requisits

- Node.js 24 LTS. La versio fixada es a `.nvmrc`.
- Projecte de Supabase amb taules, politiques, Auth i buckets necessaris.
- `.env` a l'arrel amb variables de Supabase i backend.

En Windows PowerShell, usa `npm.cmd ...` si `npm` queda bloquejat.

## Comandes Habituals

```bash
npm run dev          # nomes frontend
npm run dev:all      # frontend + backend
npm run check        # lint, tests i build UI
npm run build        # build UI de produccio
```

## Documentacio

- [Guia del projecte](docs/project-guide-ca.md)
- [Guia del projecte en angles](docs/project-guide.md)
- [Arquitectura](docs/architecture/README.md)
- [Manual CLI](docs/manuals/manual-cli-ca.md)

## Release

Release major actual: `v1.0.0`
