# Diagrames d'arquitectura d'IssueLine

Darrera actualització: 2026-06-01.

Aquests diagrames documenten el desplegament actual d'IssueLine, els límits de
l'aplicació, el model de dades canònic de Supabase i els fluxos operatius.

## Diagrames

- [Infraestructura](./diagrams/infrastructure.mmd)
- [Arquitectura de l'aplicació](./diagrams/application-architecture.mmd)
- [Model de dades canònic](./diagrams/data-model.mmd)
- [Seqüència d'ingesta GCD](./diagrams/gcd-ingestion-sequence.mmd)
- [Seqüència de timeline i estats dels números](./diagrams/timeline-issue-state-sequence.mmd)

Les exportacions SVG es troben al costat de les fonts Mermaid:

- [Annex B. Model de dades relacional](./diagrams/annex-b-model-de-dades-relacional.svg)
- [Annex C. Infraestructura i desplegament](./diagrams/annex-c-infraestructura-i-desplegament.svg)
- [Annex D. Arquitectura de l'aplicació](./diagrams/annex-d-arquitectura-de-l-aplicacio.svg)
- [Annex E. Seqüència de consulta de timeline i actualització d'estats](./diagrams/annex-e-sequencia-timeline-i-estats.svg)
- [Annex F. Seqüència d'ingesta de dades mitjançant CLI](./diagrams/annex-f-sequencia-ingesta-cli.svg)

## Decisions d'arquitectura actuals

- L'SPA React/Vite es desplega a Vercel i l'API Node/Express es desplega a Render
  des de `backend/Dockerfile`.
- Les lectures del catàleg al navegador usen el client anònim de Supabase i RLS.
  L'API Express i les eines CLI d'ingesta usen el service role de Supabase.
- Les mutacions HTTP editorials requereixen un token bearer vàlid de Supabase amb
  un rol admin a `app_metadata`.
- `hero_issues` és la memòria cau canònica dels còmics importats. `hero_timelines`
  és el flux de presentació i enllaça els números importats mitjançant `hero_issue_id`.
- `hero_timelines.event_type` és l'única font de veritat de la UI per a les fites
  editorials: `issue` per als còmics importats i `milestone` per als esdeveniments editorials.
- L'esquema de Supabase es considera ja provisionat en l'entorn de producciÃ³.

## Regeneració de les exportacions SVG

Els fitxers Mermaid són les fonts editables. Cal regenerar els fitxers SVG amb
qualsevol renderitzador compatible amb Mermaid després de modificar una font.
Per exemple, amb la CLI de Mermaid instal·lada localment:

```bash
mmdc -i docs/architecture/diagrams/data-model.mmd -o docs/architecture/diagrams/annex-b-model-de-dades-relacional.svg
mmdc -i docs/architecture/diagrams/infrastructure.mmd -o docs/architecture/diagrams/annex-c-infraestructura-i-desplegament.svg
mmdc -i docs/architecture/diagrams/application-architecture.mmd -o docs/architecture/diagrams/annex-d-arquitectura-de-l-aplicacio.svg
mmdc -i docs/architecture/diagrams/timeline-issue-state-sequence.mmd -o docs/architecture/diagrams/annex-e-sequencia-timeline-i-estats.svg
mmdc -i docs/architecture/diagrams/gcd-ingestion-sequence.mmd -o docs/architecture/diagrams/annex-f-sequencia-ingesta-cli.svg
```
