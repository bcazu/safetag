-- Captura v2 del formulario AIS (kobo/ais.xlsx 2026081702):
-- trazabilidad del brigadista (sección 14 adaptada), ocupación no sensible
-- (sección 11), comentarios (sección 13).
--
-- El resto de lo nuevo del formulario NO necesita columnas: la sección 5.2
-- observable va en `geotechnical` (jsonb, 0004), los peligros exteriores en
-- `nonstructural_damage` (jsonb, 0004) y el ancho de la peor grieta dentro
-- de `structural_damage`. El webhook arma esos objetos.

alter table cases
  -- sección 11, solo el dato NO sensible; heridos/fallecidos siguen en
  -- `occupancy` (sin grant) a la espera del consentimiento expreso de T6
  add column is_inhabited text
    check (is_inhabited in ('yes', 'no', 'unknown')),
  -- sección 13
  add column comments text,
  -- sección 14 adaptada a brigadas: quién documentó (código o nombre) y su
  -- comisión. No es PII de terceros; sí es trazabilidad exigible del reporte.
  add column inspector_code text,
  add column commission_code text;

-- Gotcha 0009→0010: toda columna nueva de `cases` necesita su grant de
-- SELECT por columna o los selects que la pidan fallan con 42501/403.
grant select (is_inhabited, comments, inspector_code, commission_code)
  on cases to authenticated;
