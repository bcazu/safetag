# CLAUDE.md — SafeTag

Plataforma de triage estructural post-sismo (sismo 7,4 Mw, 10-ago-2026, Colombia):
captura en campo (KoboToolbox) → revisión remota por ingenieros matriculados →
priorización para el PMU. Monorepo pnpm.

## Fuentes de verdad

- `docs/HANDOFF.md` — plan de acción vigente (tareas T1–T7, estado normativo).
- `docs/marco-normativo-y-negocio.md` — justificación: Formulario Único AIS,
  leyes 842/1581/1523, umbrales verificados y vacíos.
- Si el código contradice el handoff, gana el handoff. Si algo del handoff
  parece incompleto, preguntar antes de interpretar.

## Reglas duras (no negociables, justificadas en el handoff)

1. La metodología es el **Formulario Único AIS** (Comité AIS-400), no ATC-20.
2. **Cuatro colores**: `green|yellow|orange|red` (+`site_visit`). Nunca tres.
3. La habitabilidad **se deriva** de los cuatro riesgos (`packages/rules`,
   `deriveHabitability`). El revisor solo se desvía con `override_justification`
   — hay constraint en BD (`override_needs_reason`), no solo validación de UI.
4. Ningún dictamen remoto por foto puede ser `green` (usar `allowedResults`).
5. Umbrales de grieta **por sistema estructural**, como **datos versionados**
   (`packages/rules/src/data/*.json`), jamás constantes globales en código.
6. **PROHIBIDO inventar** los valores de las tablas AIS no verificadas
   (3-8 bahareque, 3-9 acero, 3-10 madera, 3-11 entrepisos, 3-12, 3-13, 3-21).
   Para esos casos se devuelve `unknown` y se marca `TODO(tabla 3-X)`.
   Un hueco marcado > un número plausible.
7. "Rojo" significa peligro de colapso/evacuación, **no demolición**. La opción
   de demolición se bloquea salvo `reviewers.can_recommend_demolition`.
8. El brigadista **documenta, no evalúa**: el formulario captura observaciones;
   los riesgos y la habitabilidad los asigna el revisor profesional. (La
   metodología AIS no contempla evaluadores legos — este es el argumento.)
9. Enrutamiento por especialidad = cumplimiento (Ley 842 art. 19): usos
   3/4/8 (educacional/salud/institucional) → revisor estructural; hallazgos
   geotécnicos → geotecnista. Ya codificado en `routeCase`; la UI lo consume.

## Estructura

```
apps/web/         React+Vite — /revisar, /mapa, dashboard PMU (hoy placeholder)
apps/brigada/     PWA seguridad de brigadistas (hoy placeholder)
packages/rules/   Motor de reglas AIS: habitabilidad, umbrales, enrutamiento
packages/i18n/    i18next compartido + términos de dominio (es)
supabase/         migrations/ (0001-0005) y functions/kobo-webhook
kobo/             gen_xlsform.py → ais.xlsx (Formulario Único AIS v1)
docs/             HANDOFF, marco normativo, setup, diseño
```

Si hay que recortar alcance: nunca por el lado del dashboard, la cola de
revisión y la trazabilidad del dictamen (es el cuello real del operativo);
recortar por IA y captura propia.

## Convenciones

- **BD**: identificadores y slugs de valores en **inglés** (`pending`,
  `not_allowed`, `heavy`). Textos visibles: nunca en BD, siempre vía i18n.
- **Formulario Kobo**: nombres de campo en **español** (los ven brigadistas).
  El webhook (`supabase/functions/kobo-webhook`) traduce nombres y slugs.
  Los `name` del XLSForm son contrato con el webhook: no renombrar uno sin
  actualizar el otro.
- `kobo/ais.xlsx` **no se edita a mano**: se regenera con `kobo/gen_xlsform.py`
  y se valida con `xls2xform` (pyxform). Tras cambiarlo: Replace form + Deploy
  en Kobo (ojo: cambiar `form_id` puede exigir proyecto nuevo + re-registrar
  el REST Service).
- **i18n**: español es el idioma base. Términos de dominio compartidos en
  `packages/i18n` (namespace `common`); strings propios de cada app en su
  `locales/es/app.json` (namespace `app`). Sumar idioma: `common.json` nuevo +
  `SUPPORTED_LANGUAGES` (apps) y `LANGS` en `gen_xlsform.py` (formulario).
- **Migraciones**: numeradas en `supabase/migrations/`; no editar una ya
  aplicada al remoto — crear la siguiente. Seguridad como **políticas RLS**,
  nunca solo validación de cliente. RLS está activo en todas las tablas y
  cerrado por defecto (las políticas se agregan según se necesiten).
- Commits en español, imperativo, con cuerpo explicando el porqué.

## Comandos

```sh
pnpm install
pnpm --filter web dev | build | lint        # ídem brigada
pnpm --filter @safetag/rules test           # vitest; también typecheck
pnpm exec supabase db push                  # aplicar migraciones al remoto
pnpm exec supabase db query "sql" --linked  # consultas (sin password, usa login role)
pnpm exec supabase functions deploy kobo-webhook --no-verify-jwt
pnpm exec supabase db reset --linked --yes  # DESTRUCTIVO: reaplica 0001→000N desde cero
```

Regenerar el formulario (openpyxl y pyxform en un venv):

```sh
python kobo/gen_xlsform.py && xls2xform kobo/ais.xlsx /tmp/ais.xml
```

## Infraestructura

- Supabase: proyecto `safetag` (`ikyhuxspyoknblwpcsoq`, São Paulo). PostGIS
  activo. Bucket privado `photos` creado por migración (no manual).
- Edge Function `kobo-webhook` (`--no-verify-jwt`): autentica con header
  `x-webhook-secret`. Secrets: `KOBO_WEBHOOK_SECRET`, `KOBO_API_TOKEN`
  (descarga de fotos adjuntas; sin él, guarda el caso y omite fotos).
- Frontends: Vite; variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
  (se usa la key publishable `sb_publishable_…`, pública por diseño).
  Deploy previsto en Vercel (un proyecto por app, root `apps/web` y
  `apps/brigada`).

## Gotchas aprendidos

- Los proyectos nuevos de Supabase **no dan grants de DML** a los roles de la
  API (solo TRUNCATE/REFERENCES/TRIGGER): sin `0002_grants.sql` todo insert
  falla con 42501 "permission denied". Tablas nuevas los heredan por
  default privileges; si algo da 42501, revisar grants antes que RLS.
- Las políticas RLS con subconsulta a otra tabla (p. ej. `reviewers`) están
  sujetas al RLS de esa tabla: sin una política de SELECT sobre ella, el
  `EXISTS` siempre es falso y el insert se deniega en silencio.
- Kobo entrega `select_multiple` como string separado por espacios y
  `_geolocation` como `[lat, lon]` (PostGIS quiere `POINT(lon lat)`).
- Los adjuntos de Kobo requieren `Authorization: Token …`; el filename del
  submission llega con espacios convertidos a `_`.
- El webhook responde 200 en duplicados (23505) para cortar reintentos de
  Kobo; las fotos son best-effort para no duplicar casos por reintento.
- `cases` tiene grants de SELECT **por columna** (0006 excluye la PII):
  `select('*')` desde el cliente falla con 42501 — usar siempre lista
  explícita de columnas. Y toda migración que agregue una columna a `cases`
  debe incluir su `grant select (col) to authenticated` o los selects que la
  pidan fallan con 403 (pasó con 0009 → fix en 0010).

## Datos personales (Ley 1581)

`cases.contact` (cédula/teléfono) y `cases.occupancy` (heridos/fallecidos =
dato sensible) exigen RLS restrictiva y consentimiento (T6, pendiente).
No exponerlos en vistas públicas ni en logs.
