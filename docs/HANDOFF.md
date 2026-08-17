# HANDOFF — Corrección normativa de SafeTag

**Fecha:** 16 de agosto de 2026
**Origen:** investigación de fuentes oficiales. Detalle completo y citas en `docs/marco-normativo.md`.
**Para:** Claude Code, repo `bcazu/safetag`.

Lee `docs/marco-normativo.md` antes de tocar código. Este archivo es el plan de acción;
ese otro es la justificación.

---

## Contexto en una frase

El proyecto asumió el protocolo ATC-20 estadounidense. El estándar que se está usando
en Pereira ahora mismo es el **Formulario Único AIS** (Asociación Colombiana de
Ingeniería Sísmica, Comité AIS-400), que es más detallado, tiene cuatro categorías de
habitabilidad en vez de tres, y define umbrales de daño distintos por material. Hay que
realinear el esquema, el formulario y las reglas de negocio antes de seguir construyendo
features.

---

## Errores en el código/diseño actual

| # | Dónde | Qué está mal |
|---|---|---|
| 1 | `supabase/migrations/0001_schema.sql`, `assessments.result` | Faltan estados. Son **cuatro** colores: verde, amarillo, **naranja**, rojo |
| 2 | Mismo archivo | Falta lo que *produce* el color: cuatro riesgos independientes con cuatro niveles cada uno |
| 3 | `cases` | Faltan ~15 campos del formulario oficial (sistema estructural, uso, año, tipo de inspección, condiciones preexistentes, ocupación) |
| 4 | `kobo/atc20.xlsx` + `kobo/README.md` | El formulario debe rehacerse sobre las 17 secciones del Formulario Único AIS. Renombrar a `kobo/ais.xlsx` |
| 5 | `docs/triage-estructural-post-sismo.md` | "Grietas > 3 mm → evacuar" es incorrecto como regla general: el umbral depende del sistema constructivo |
| 6 | `reviewers` | `professional_license` sin validación y `verified bool` sin decir contra qué. Ley 842 de 2003 exige matrícula vigente y **rama** correspondiente |
| 7 | Todo el flujo | No hay consentimiento de datos personales, y el formulario captura cédula, teléfono, y número de heridos/fallecidos (dato sensible de salud) |

---

## Regla central a implementar

La habitabilidad **no la elige el revisor a mano**: se deriva de cuatro riesgos.

```
riesgos = [estabilidad_global, geotecnico, estructural, no_estructural]
niveles = low | low_after_measures | high | very_high

si algún riesgo == very_high  OR  count(high) > 2  → 'red'      Peligro de colapso
sino si algún riesgo == high                        → 'orange'   No habitable
sino si algún riesgo == low_after_measures          → 'yellow'   Uso restringido
sino (los cuatro son low)                           → 'green'    Habitable
```

Evaluar en ese orden (de mayor a menor severidad; la primera que se cumple manda).

La UI muestra el resultado derivado. El revisor puede desviarse, pero entonces
`override_justification` es obligatorio y se guarda. Nunca sobreescribir en silencio.

**Semántica que hay que respetar en los textos de la UI:** naranja = hay daño
estructural, capacidad de carga reducida, no se ocupa hasta evaluación detallada.
Rojo = riesgo inminente de colapso, evacuación del edificio y del entorno.
**Rojo no significa demoler.**

---

## Tareas en orden

### T1 — Migración `0004_ais_alignment.sql`

```sql
-- assessments
ALTER TABLE assessments
  DROP CONSTRAINT IF EXISTS assessments_result_check,
  ADD CONSTRAINT assessments_result_check
    CHECK (result IN ('green','yellow','orange','red','site_visit'));

ALTER TABLE assessments
  ADD COLUMN risk_global_stability text
    CHECK (risk_global_stability IN ('low','low_after_measures','high','very_high')),
  ADD COLUMN risk_geotechnical    text CHECK (...mismo enum...),
  ADD COLUMN risk_structural      text CHECK (...),
  ADD COLUMN risk_nonstructural   text CHECK (...),
  ADD COLUMN derived_result       text,           -- lo que dio el algoritmo
  ADD COLUMN override_justification text,         -- obligatorio si result <> derived_result
  ADD COLUMN safety_measures      jsonb,          -- secciones 5.x y 9, multi-selección
  ADD COLUMN specialist_visit     jsonb;          -- estructural | geotécnico | serv. públicos

-- constraint: si se desvía, hay que justificar
ALTER TABLE assessments ADD CONSTRAINT override_needs_reason
  CHECK (result = derived_result OR override_justification IS NOT NULL);
```

```sql
-- cases: campos del Formulario Único AIS
ALTER TABLE cases
  ADD COLUMN inspection_type      text,   -- exterior|partial|complete|not_inspected
  ADD COLUMN not_inspected_reason text,   -- no_permitido|desocupada|colapso|demolida|otro
  ADD COLUMN cadastral_id         text,   -- sector-manzana-predio-mejora (IGAC)
  ADD COLUMN commune              text,
  ADD COLUMN building_name        text,
  ADD COLUMN structural_system    text,   -- código AIS, ver tabla abajo
  ADD COLUMN floor_system         text,
  ADD COLUMN building_use         int,    -- 1..11
  ADD COLUMN ground_floor_use     int,
  ADD COLUMN year_range           int,    -- 1..4
  ADD COLUMN floors_above         int,
  ADD COLUMN basements            int,
  ADD COLUMN front_m              numeric,
  ADD COLUMN depth_m              numeric,
  ADD COLUMN worst_damaged_floor  int,
  ADD COLUMN global_damage_pct    text,   -- rango, no número
  ADD COLUMN structural_damage    jsonb,  -- matriz elemento × nivel × %extensión
  ADD COLUMN nonstructural_damage jsonb,  -- 10 elementos × 5 niveles
  ADD COLUMN geotechnical         jsonb,  -- sección 5.2
  ADD COLUMN preexisting          jsonb,  -- sección 8, variables A..I
  ADD COLUMN occupancy            jsonb,  -- secciones 10 y 11
  ADD COLUMN contact              jsonb;  -- ⚠️ PII: cédula + teléfono, RLS restringida

-- num_floors queda obsoleto: migrar a floors_above/basements y eliminar
```

`warning_signs jsonb` puede quedarse como señales rápidas para la IA, pero **no** es el
registro de daño: ese es `structural_damage`.

### T2 — Migración `0005_reviewer_credentials.sql`

```sql
ALTER TABLE reviewers
  ADD COLUMN license_branch text,        -- rama de la matrícula (Ley 842 art. 19)
  ADD COLUMN license_verified_at timestamptz,
  ADD COLUMN license_status text DEFAULT 'unverified',  -- unverified|active|suspended
  ADD COLUMN specialty text,             -- structural | geotechnical | general
  ADD COLUMN can_recommend_demolition boolean DEFAULT false;
```

RLS: un reviewer con `license_status <> 'active'` no puede insertar en `assessments`.
Implementar como política, no como validación de cliente.

### T3 — Motor de reglas compartido

Crear `packages/rules/` (o `apps/web/src/lib/habitability.ts` si prefieres no crear
paquete todavía) con:

- `deriveHabitability(risks): Result` — el algoritmo de arriba, con tests unitarios que
  cubran los cuatro caminos y el caso `count(high) > 2`.
- `damageLevelThresholds(structuralSystem)` — devuelve los rangos de ancho de grieta.
  **No hardcodear un umbral global.** Los valores están en `docs/marco-normativo.md`,
  sección "Umbrales de grieta". Resumen: concreto `<0.2 / 0.2–1.0 / 1.0–2.0 / >2.0+refuerzo
  expuesto / aplastamiento`; mampostería `<0.2 / 0.2–1.0 / 1.0–3.0 / >3.0 / desprendimiento`;
  tapia-adobe `<0.4 / 0.4–2.0 / 2.0–4.0 / >4.0 / aplastamiento`.
- `routeCase(case): RequiredSpecialty` — reglas de enrutamiento (ver T4).

Este módulo se consume desde la app de revisión y, en fase 2, desde el servicio de IA.
Una sola fuente de verdad.

### T4 — Reglas de enrutamiento y permisos

Obligatorias por normativa, no opcionales:

1. Si `building_use ∈ {3, 4, 8}` (educacional, salud, institucional) → el caso solo
   puede ser dictaminado por `specialty = 'structural'`. La metodología AIS exige
   ingeniero estructural para edificaciones indispensables o de atención a la comunidad.
2. Si `geotechnical` reporta asentamiento evidente o falla en talud → requiere
   `specialty = 'geotechnical'` o marcar "requiere visita especializada".
3. La opción "posible demolición" en `safety_measures` se deshabilita salvo
   `can_recommend_demolition = true`. Personal sin experiencia en diseño o patología
   estructural no puede recomendarla; en su lugar debe escalar con visita prioritaria.
4. `result = 'green'` está **prohibido** en dictámenes remotos por foto. La opción no
   debe existir en `/revisar` mientras el caso venga de captura remota. Solo
   `yellow | orange | red | site_visit`. (Principio de diseño no negociable del doc de
   arquitectura: no hay verde definitivo sin inspección presencial.)

### T5 — Formulario Kobo

Rehacer `kobo/atc20.xlsx` → `kobo/ais.xlsx` sobre las 17 secciones. Prioridad de campos
para la v1 (no hace falta todo el formulario de una):

**Imprescindibles:** 1 (catastral), 2 (tipo inspección), 3 (identificación), 4 (estructura),
5.1 (estabilidad global), 5.3 (daños estructurales), 6 (% global), 17 (fotos).
**Segunda pasada:** 5.2, 5.4, 8, 9, 10, 11, 12, 13.

Listas de opciones a codificar tal cual:

```
structural_system:
  11 Pórtico concreto      12 Muros estructurales   13 Sistemas duales   14 Prefabricado
  21 Mampostería confinada 22 Mamp. reforzada       23 Mamp. no reforzada
  31 Pórticos arriostrados 32 No arriostrados       33 En celosía
  41 Pórticos/panel madera 42 Pórticos madera+otros
  51 Muros bahareque       52 Muros tapia
  50 Mixta                 60 Otros

floor_system:
  11 Placa maciza  12 Placa aligerada  13 Reticular celulado
  21 Vigas alma llena c/conectores  22 s/conectores  23 Cerchas (acero)
  31 Vigas  32 Cerchas (madera)   40 Mixta   50 Otros

building_use:
  1 Residencial 2 Comercial 3 Educacional 4 Salud 5 Hotelero 6 Oficinas
  7 Industrial  8 Institucional 9 Bodegas 10 Estacionamientos 11 Otros

year_range:
  1 Antes de 1950   2 1950–1982   3 1982–1997   4 A partir de 1998
```

La matriz de daño estructural (5.3) depende del sistema: usar lógica condicional XLSForm
para mostrar los elementos correctos.

| Sistema | Elementos a evaluar |
|---|---|
| Pórtico concreto | vigas, columnas, nudos, entrepisos |
| Pórtico + muros estructurales | vigas, columnas, nudos, muros, entrepisos |
| Acero / madera | vigas, columnas, conexiones, entrepisos |
| Mampostería | muros portantes (+ columnetas y vigas de confinamiento si confinada), entrepiso |
| Tapia / adobe / bahareque | muros portantes, entrepiso |

Cada elemento: nivel (ninguno/leve/moderado/fuerte/severo) + % de extensión. La suma de
porcentajes por elemento debe dar 100%. Se evalúa **el piso de mayor daño**, y hay que
registrar cuál es.

Secuencia de fotos obligatoria (mantener lo del doc de diseño): fachada completa, cada
esquina, peor grieta de cerca con objeto de escala, columnas del primer piso.

### T6 — Consentimiento y datos personales

- Página inicial del formulario Kobo: aviso de privacidad + autorización explícita.
  Mencionar expresamente que los datos de heridos y fallecidos (sección 10) son sensibles
  y que el titular no está obligado a autorizar su tratamiento.
- `contact` (cédula + teléfono) con RLS restrictiva: solo rol PMU y el revisor asignado.
- `brigade_locations`: TTL 24 h ya está previsto; añadir borrado automático real (cron o
  política) y consentimiento al activar "en misión".
- Crear `docs/politica-datos.md` con política de tratamiento, aviso de privacidad y nota
  sobre transferencia internacional (Supabase São Paulo, Vercel).

### T7 — Webhook

Actualizar `supabase/functions/kobo-webhook/index.ts` con el mapeo real del nuevo
formulario. Eliminar el TODO. Los nombres XLSForm van en español; los identificadores de
BD en inglés, como ya está definido.

---

## Lo que NO hay que cambiar

- La arquitectura general (Kobo + Supabase + React + Leaflet) sigue siendo correcta.
- La PWA Brigada y sus features de seguridad no se tocan; son valor diferencial y no
  tienen implicación normativa más allá del consentimiento de ubicación.
- La IA sigue siendo fase 2. Con el motor de reglas de T3 bien hecho, el sistema entrega
  valor sin ella.

---

## Criterio de terminado

- [ ] `pnpm exec supabase db reset` aplica 0001→0005 sin errores
- [ ] Tests de `deriveHabitability` cubren los 4 resultados + el caso `count(high) > 2`
- [ ] `/revisar` no ofrece "verde" en casos de captura remota
- [ ] Un reviewer sin `license_status = 'active'` no puede insertar un dictamen (probado
      contra RLS, no solo en UI)
- [ ] Ciclo completo: submission Kobo con el nuevo formulario → `cases` con todos los
      campos poblados → dictamen con los cuatro riesgos → color derivado correcto

---

## Nota de contexto para priorizar

El operativo real lleva seis días corriendo en Pereira con voluntarios coordinados por la
Asociación de Ingenieros de Risaralda, y hay al menos una plataforma competidora en línea.
El cuello de botella observado es **consolidación y coordinación**, no captura. Si hay que
recortar alcance, recortar por el lado de la IA y de la captura propia; nunca por el lado
del dashboard, la cola de revisión y la trazabilidad del dictamen.
