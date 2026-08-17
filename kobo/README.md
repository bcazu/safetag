# Formulario Único AIS (XLSForm)

Digitalización del *Formulario Único de Inspección de Edificaciones Después de
un Sismo* (AIS, Comité AIS-400) para KoboToolbox. Marco completo y fuentes en
`docs/marco-normativo-y-negocio.md`; plan en `docs/HANDOFF.md`.

- `ais.xlsx` — XLSForm v1. **No editarlo a mano**: se genera con
  `gen_xlsform.py` (instrucciones de uso y validación en su docstring).
- **v1** cubre las secciones imprescindibles: 1 (catastral), 2 (tipo de
  inspección), 3 (identificación), 4 (estructura), 5.1 (estabilidad global),
  5.3 (daños estructurales), 6 (% global) y 17 (fotos). Segunda pasada:
  5.2, 5.4, 8, 9, 10, 11, 12, 13.
- Principio de diseño: el brigadista **documenta**, no evalúa. El formulario
  captura observaciones; los riesgos y la habitabilidad los asigna el revisor
  profesional con `packages/rules` (algoritmo AIS sección 7).
- Multiidioma: columnas `label::Español (es)`; sumar idioma = ampliar `LANGS`
  en el generador. Al cambiar el formulario: **Replace form** en Kobo +
  Deploy. Los `name` de los campos son el contrato con el webhook: no
  renombrar sin actualizar `supabase/functions/kobo-webhook`.
- El formulario debe validarse con un ingeniero estructural antes del piloto.

## Mapeo al esquema (webhook)

Los nombres de campo están en español (los ven los brigadistas); el webhook
traduce nombres y slugs a las columnas en inglés de `cases` (migración 0004).

| Sección AIS | Campo XLSForm | Columna en `cases` |
|---|---|---|
| 2 | `tipo_inspeccion` | `inspection_type` (`exterior/partial/complete/not_inspected`) |
| 2 | `motivo_no_inspeccion` | `not_inspected_reason` |
| 1 | `comuna` / `barrio` / `id_catastral` | `commune` / `neighborhood` / `cadastral_id` |
| 3 | `direccion` / `nombre_edificacion` / `gps` | `address` / `building_name` / `location` |
| 3 | `pisos_sobre` / `sotanos` | `floors_above` / `basements` |
| 3 | `uso_predominante` / `uso_planta_baja` | `building_use` / `ground_floor_use` (códigos 1–11) |
| 3 | `frente_m` / `fondo_m` | `front_m` / `depth_m` |
| 4 | `sistema_estructural` / `tipo_entrepiso` / `rango_ano` | `structural_system` / `floor_system` / `year_range` (los slugs del formulario **son** los códigos AIS) |
| 5.1 | `colapso` / `inclinacion` | `structural_damage.stability` |
| 5.3 | `piso_mayor_dano` | `worst_damaged_floor` |
| 5.3 | `dano_<elemento>` + `dano_<elemento>_pct` | `structural_damage.elements.<clave>` (`{level, extent_pct}`) |
| 6 | `dano_global` | `global_damage_pct` |
| — | `senales_alarma` | `warning_signs` (señales rápidas para IA; el registro de daño oficial es la matriz 5.3) |

La matriz 5.3 usa lógica condicional: cada elemento solo aparece si aplica al
sistema estructural elegido (p. ej. `nudos` solo en pórticos de concreto,
`columnetas`/`vigas_confinamiento` solo en mampostería confinada).

Secuencia de fotos (sección 17; KoboCollect comprime con `max-pixels`):

| Campo | Obligatoria | `photo_type` en `photos` |
|---|---|---|
| `foto_fachada` | sí | `fachada` |
| `foto_esquina_1`, `foto_esquina_2` | sí | `esquina_1`, `esquina_2` |
| `foto_esquina_3`, `foto_esquina_4` | no (esquinas inaccesibles) | `esquina_3`, `esquina_4` |
| `foto_grieta` (con moneda de escala; max-pixels 2048) | sí | `grieta` |
| `foto_columnas` | sí | `columnas` |

El webhook descarga los adjuntos de la API de Kobo (secret `KOBO_API_TOKEN`),
los sube al bucket privado `photos` como `cases/<case_id>/<campo>.<ext>` y
registra metadatos en `public.photos`. Si una foto falla, el caso se guarda
igual (best-effort) y el error queda en los logs de la función.

El XLSForm es portable a ArcGIS Survey123 sin reescritura si la alianza con
la alcaldía lo requiere.
