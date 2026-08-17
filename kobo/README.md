# Formulario ATC-20 (XLSForm)

Aquí vive el formulario de captura en campo para KoboToolbox.

- `atc20.xlsx` — XLSForm del formulario. **No editarlo a mano**: se genera con
  `gen_xlsform.py` (ver instrucciones de uso y validación en su docstring).
- Multiidioma: los textos usan columnas `label::Español (es)`; para sumar un
  idioma se añade a `LANGS` en el generador y se completan los diccionarios
  de traducción. KoboCollect y Enketo muestran el selector de idioma solos.
  Al cambiar el formulario, subir el nuevo xlsx con **Replace form** en Kobo
  y volver a hacer Deploy (los `name` de los campos no deben cambiar: son el
  contrato con el webhook).
- El formulario debe validarse con un ingeniero estructural antes del piloto.

## Campos y mapeo al esquema

Los nombres de campo están en español (los ven los brigadistas); el webhook
(`supabase/functions/kobo-webhook`) los traduce a las columnas en inglés.

| Campo XLSForm | Tipo | Columna en `cases` |
|---|---|---|
| `direccion` | text, obligatorio | `address` |
| `barrio` (+ `barrio_otro` si "otro") | select_one comunas de Pereira | `neighborhood` |
| `gps` | geopoint obligatorio (+ `start-geopoint` de respaldo) | `location` |
| `sistema_constructivo` | select_one | `construction_system` |
| `num_pisos` | integer 1–50 | `num_floors` |
| `senales_alarma` | select_multiple (incluye "ninguna", excluyente) | `warning_signs` (array jsonb) |

Secuencia de fotos (tipo image; KoboCollect comprime con `max-pixels`):

| Campo | Obligatoria | `photo_type` en `photos` |
|---|---|---|
| `foto_fachada` | sí | `fachada` |
| `foto_esquina_1`, `foto_esquina_2` | sí | `esquina_1`, `esquina_2` |
| `foto_esquina_3`, `foto_esquina_4` | no (esquinas inaccesibles) | `esquina_3`, `esquina_4` |
| `foto_grieta` (con moneda de escala; max-pixels 2048) | sí | `grieta` |
| `foto_columnas` | sí | `columnas` |

El webhook descarga los adjuntos de la API de Kobo (requiere el secret
`KOBO_API_TOKEN` en las Edge Functions) y los sube al bucket privado `photos`
como `cases/<case_id>/<campo>.<ext>`, registrando metadatos en
`public.photos`. Si una foto falla, el caso se guarda igual (best-effort) y
el error queda en los logs de la función.

El XLSForm es portable a ArcGIS Survey123 sin reescritura si la alianza con
la alcaldía lo requiere.
