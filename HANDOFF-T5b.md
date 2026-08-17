# HANDOFF-T5b — Bloque de ubicación del formulario Kobo

**Fecha:** 16 de agosto de 2026
**Extiende:** la tarea T5 de `HANDOFF.md`. Leer antes: `HANDOFF.md` (reglas duras y
lista de códigos AIS) y `CLAUDE.md`. Este documento define el bloque de
**ubicación/identificación** del XLSForm; el resto de T5 (matriz de daño, riesgos,
fotos) no cambia.

---

## Principios de diseño (por qué, antes del qué)

1. **El GPS es la fuente de verdad; los nombres son metadatos legibles.** Barrio y
   comuna se piden para que el PMU filtre y reporte, pero si el brigadista se equivoca,
   el punto GPS permite reasignar por `ST_Contains` contra los polígonos en PostGIS.
   Consecuencia: ninguna lista incompleta puede bloquear una evaluación → siempre hay
   opción "Otro" + texto libre.
2. **La identificación catastral (IGAC) NO se le exige al brigadista.** El manual AIS
   lo dice explícitamente: el número predial se asigna en oficina cruzando con
   catastro. En el formulario es un grupo opcional y colapsado.
3. **Listas territoriales como archivos CSV adjuntos** (`select_one_from_file`), nunca
   en la hoja `choices`. Cali tiene ~340 barrios; corregir una lista no puede exigir
   redesplegar el formulario.
4. **Urbano y rural comparten estructura** con etiquetas distintas: comuna ↔
   corregimiento, barrio ↔ vereda. En BD es la misma columna. Chocó rural degrada a
   municipio + corregimiento + vereda + GPS + referencia textual, sin ramas especiales.

---

## T5b.1 — Archivos CSV de listas territoriales

Crear en `kobo/media/` (Kobo los adjunta como "media files" del formulario):

**`municipios.csv`**
```csv
name,label,departamento_code
66001,Pereira,66
66170,Dosquebradas,66
76001,Cali,76
27001,Quibdó,27
27660,San José del Palmar,27
```
- `name` = código DANE de 5 dígitos (ES el valor que se guarda — nunca el nombre).
- Poblar con los municipios del área de operación inicial; la fuente completa es la
  tabla DIVIPOLA del DANE (descarga pública). No inventar códigos: verificarlos
  contra DIVIPOLA.

**`divisiones.csv`** (comunas y corregimientos)
```csv
name,label,municipio_code,tipo
66001-C01,Comuna 1 – Villavicencio,66001,urbano
66001-CO-ALTAGRACIA,Corregimiento Altagracia,66001,rural
76001-C03,Comuna 3,76001,urbano
```

**`barrios.csv`** (barrios y veredas)
```csv
name,label,municipio_code,division_code
66001-B-CENTRO,Centro,66001,66001-C01
66001-V-ELMANZANO,Vereda El Manzano,66001,66001-CO-ALTAGRACIA
```

- Los `name` de divisiones y barrios son slugs propios (no hay codificación nacional
  de barrios); prefijarlos con el código de municipio garantiza unicidad.
- Sembrar Pereira y Cali desde sus geoportales (IDESC para Cali; geoportal de
  Pereira). Si no hay fuente inmediata para un municipio, dejar el CSV con las
  divisiones y confiar en el flujo "Otro" — no bloquear por datos faltantes.
- **Los mismos shapefiles/GeoJSON de esos geoportales se cargan después a PostGIS**
  (tabla `territorial_divisions` con geometría) para la reasignación por ST_Contains
  y los filtros del dashboard. Mantener los slugs idénticos entre CSV y BD.

## T5b.2 — Bloque en la hoja `survey` del XLSForm

Orden y lógica (nombres de campo en español, como todo el XLSForm):

| type | name | label | required | relevant / notas |
|---|---|---|---|---|
| select_one_from_file municipios.csv | municipio | Municipio | yes | |
| select_one tipo_zona | tipo_zona | Tipo de zona | yes | opciones: urbano / rural |
| select_one_from_file divisiones.csv | division | Comuna | yes | `choice_filter`: municipio_code=${municipio} and tipo=${tipo_zona} · label dinámico: "Comuna" si urbano, "Corregimiento" si rural (usar dos preguntas con relevant excluyente O label con referencia — preferir dos preguntas `division_urbana`/`division_rural` que mapean a la misma columna, es más simple en XLSForm) |
| select_one_from_file barrios.csv | barrio | Barrio / Vereda | yes | `choice_filter`: division_code=${division} · incluir choice estático "OTRO – No está en la lista" |
| text | barrio_otro | ¿Cuál? | yes | relevant: ${barrio}='OTRO' |
| select_one via_tipo | via_tipo | Tipo de vía | no | relevant: ${tipo_zona}='urbano' · opciones: carrera/calle/transversal/diagonal/avenida/otra |
| text | via_numero | Número de vía | no | relevant: ${tipo_zona}='urbano' |
| text | numero_placa | Número (placa) | no | relevant: ${tipo_zona}='urbano' |
| text | referencia_ubicacion | Referencia de ubicación | no | hint: "Finca, kilómetro, punto de referencia" · relevant: ${tipo_zona}='rural' (y visible también en urbano como opcional está bien) |
| text | nombre_edificacion | Nombre de la edificación | no | hint: "Propiedad horizontal o institución" |
| geopoint | ubicacion | Ubicación GPS | **yes** | mantener además `start-geopoint` en segundo plano (ya existe en el form) |
| begin_group | catastral | Identificación catastral (opcional) | | appearance: field-list · hint: "Solo si tiene el recibo de predial a la vista" |
| text | cat_sector | Sector | no | |
| text | cat_manzana | Manzana | no | |
| text | cat_predio | Predio | no | |
| text | cat_mejora | Mejora / Prop. horizontal | no | |
| end_group | | | | |

Restricciones adicionales:
- `municipio` puede tener default por despliegue (un form desplegado para la brigada
  de Pereira puede pre-seleccionar 66001) — parámetro, no hardcode.
- No usar `constraint` que impida guardar por ubicación: el GPS puede fallar bajo
  techo; si `ubicacion` no captura, permitir reintento pero como último recurso
  aceptar el `start-geopoint` de respaldo. Nunca perder una evaluación por GPS.

## T5b.3 — Mapeo en el webhook (`supabase/functions/kobo-webhook/index.ts`)

| Campo Kobo | Columna en `cases` |
|---|---|
| municipio | `municipality_code` |
| tipo_zona | `division_type` ('urban'/'rural' — traducir del español) |
| division_urbana / division_rural | `commune` (slug) |
| barrio (o barrio_otro si barrio='OTRO') | `neighborhood` — si viene de barrio_otro, guardar también flag `neighborhood_unlisted=true` para el proceso de gabinete |
| via_tipo + via_numero + numero_placa (o referencia_ubicacion) | `address` (concatenar legible) |
| nombre_edificacion | `building_name` |
| ubicacion | `location` (PostGIS point) — fallback a start-geopoint si vacío |
| cat_sector + cat_manzana + cat_predio + cat_mejora | `cadastral_id` (concatenar con guiones; NULL si todos vacíos) |

Añadir a `cases` si no existe: `neighborhood_unlisted boolean default false`.

## T5b.4 — Post-proceso en gabinete (función SQL, no bloqueante)

Crear función `assign_territorial_division(case_id)` que, con los polígonos de
`territorial_divisions` cargados:
- calcula por `ST_Contains(polygon, location)` la comuna/barrio del punto,
- si difiere de lo capturado o si `neighborhood_unlisted`, escribe los valores
  derivados en columnas separadas (`commune_derived`, `neighborhood_derived`) —
  **sin sobreescribir lo capturado** (auditoría: lo que el brigadista dijo se
  conserva siempre).
Ejecutable en batch; no es parte del flujo del webhook (los polígonos pueden no
estar cargados aún y el webhook nunca debe fallar por eso).

## Criterio de terminado

- [ ] Los tres CSV existen con Pereira y Cali sembrados y estructura de columnas exacta
- [ ] El formulario despliega en Kobo y las cascadas filtran correctamente
      (municipio → división → barrio) en KoboCollect **offline**
- [ ] Elegir "OTRO" en barrio habilita el texto libre y el caso llega a `cases` con
      `neighborhood_unlisted=true`
- [ ] Un submission rural (corregimiento+vereda+referencia, sin dirección) y uno
      urbano (comuna+barrio+dirección) insertan correctamente
- [ ] Submission sin sección catastral → `cadastral_id` NULL, sin error
- [ ] `assign_territorial_division` existe y corre en batch sin tocar los valores
      capturados

## Prohibido

- Inventar códigos DANE o listas de barrios "de memoria": solo DIVIPOLA y geoportales
  oficiales. Si no hay fuente, CSV mínimo + flujo "Otro".
- Hacer obligatoria la sección catastral o cualquier campo que el brigadista no pueda
  saber en campo.
- Meter las listas territoriales en la hoja `choices` del XLSForm.
- Sobreescribir en BD lo que el brigadista capturó (los derivados van en columnas
  aparte).
