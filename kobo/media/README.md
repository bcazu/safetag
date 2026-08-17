# Listas territoriales (media files del formulario)

Estos CSV se suben a Kobo como **media files** del formulario (Settings →
Media) y alimentan los `select_one_from_file` del bloque de ubicación.
Corregir una lista = re-subir el CSV, **sin redesplegar** el formulario.

- `municipios.csv` — `name` ES el código DIVIPOLA (DANE, 5 dígitos), nunca el
  nombre. Solo códigos verificados contra DIVIPOLA; ampliar según el operativo.
- `divisiones.csv` — comunas (urbano) y corregimientos (rural). Los `name` son
  slugs propios prefijados con el código de municipio (no existe codificación
  nacional). Cada municipio incluye filas de escape `-C-OTRA` / `-CO-OTRO`
  para que ninguna lista incompleta bloquee una evaluación.
- `barrios.csv` — barrios y veredas por división. La fila `OTRO` es global y
  siempre visible (el `choice_filter` la incluye); elegirla habilita el texto
  libre `barrio_otro`.

Los mismos slugs se usan en la tabla `territorial_divisions` de PostGIS
(migración 0014): al cargar los polígonos, mantenerlos **idénticos**.

## TODO (fuentes oficiales pendientes — no inventar)

- TODO(DIVIPOLA): ampliar `municipios.csv` con el resto del área de operación
  desde la tabla DIVIPOLA del DANE (descarga pública).
- TODO(geoportal Pereira): corregimientos de Pereira y sus veredas; barrios
  por comuna. Cargar también los polígonos a `territorial_divisions`.
- TODO(IDESC): barrios de Cali por comuna + polígonos (geoportal IDESC).
- TODO(geoportales): comunas/corregimientos de Dosquebradas, Santa Rosa de
  Cabal, La Virginia, Quibdó y San José del Palmar (hoy solo filas de escape;
  el flujo "Otro" cubre mientras tanto).

Las comunas de Pereira y Cali sembradas aquí provienen de la lista ya curada
en el repo (formulario v2026081605); verificar contra geoportal al cargar los
polígonos.
