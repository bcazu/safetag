# SafeTag

**Post-earthquake structural triage platform.** Multiplica la capacidad de los
pocos ingenieros estructurales disponibles tras un sismo: captura en campo por
personal no experto (KoboToolbox, offline), revisión remota por ingenieros
matriculados, y priorización para el puesto de mando (PMU).

> Contexto: sismo 7,4 Mw del 10 de agosto de 2026 (Chocó, Colombia).
> El nombre viene del *safety tagging* post-sismo. La metodología es el
> **Formulario Único AIS** (Comité AIS-400), el estándar colombiano:
> 🟢 habitable · 🟡 uso restringido · 🟠 no habitable · 🔴 peligro de colapso.

## Principio de diseño no negociable

El software hace **triage y priorización**; el dictamen de habitabilidad lo
firma un ingeniero civil/estructural matriculado. La evaluación remota nunca
emite un verde definitivo por foto.

## Arquitectura

- **Captura**: KoboCollect (Android, offline) con el Formulario Único AIS → webhook.
- **Backend**: Supabase — Postgres + PostGIS, Auth + RLS, Storage, Realtime,
  Edge Functions.
- **`apps/web`**: React + Vite + TS — `/revisar` (cola de revisión),
  `/mapa` (dashboard PMU con Leaflet), `/brigadas` (monitor de campo).
- **`apps/brigada`**: PWA de seguridad del brigadista — botón de pánico,
  ubicación en vivo, check-in periódico.
- **Fase 2**: microservicio FastAPI + YOLO como pre-clasificador de fotos.

Detalle completo en [`docs/stack-tecnico-mvp.md`](docs/stack-tecnico-mvp.md) y
[`docs/triage-estructural-post-sismo.md`](docs/triage-estructural-post-sismo.md).

## Estructura del repo

```
apps/web/       App de revisión + dashboard + monitor (React/Vite/TS)
apps/brigada/   PWA Brigada (seguridad de campo)
supabase/       Migraciones SQL (esquema + RLS) y Edge Functions
kobo/           XLSForm del Formulario Único AIS
docs/           Documentos de diseño del proyecto
```

## Desarrollo

Requisitos: Node ≥ 20, pnpm.

```sh
pnpm install
pnpm dev:web       # app de revisión/dashboard
pnpm dev:brigada   # PWA Brigada
```

## Antes de escribir más código

Presentar el proyecto a la alcaldía de Pereira / PMU o a la SCI: dentro del
sistema oficial los dictámenes tienen validez y los datos alimentan la
respuesta real. Una plataforma paralela no coordinada genera confusión.
