-- Alineación con el Formulario Único AIS (Comité AIS-400).
-- Ver docs/HANDOFF.md (T1) y docs/marco-normativo-y-negocio.md §2 y §4.
--
-- Cambios centrales:
--   * assessments.result pasa de 3 a 4 colores (aparece 'orange': no habitable).
--   * El color NO lo elige el revisor: se deriva de cuatro riesgos independientes
--     (algoritmo de la sección 7 del manual, implementado en packages/rules).
--     Se guardan riesgos + derived_result + result final; desviarse exige
--     override_justification (auditable, nunca silencioso).
--   * cases incorpora los campos del formulario oficial (secciones 1-11).

-- ── assessments ──────────────────────────────────────────────────────────────

alter table assessments drop constraint if exists assessments_result_check;
alter table assessments
  add constraint assessments_result_check
    check (result in ('green', 'yellow', 'orange', 'red', 'site_visit'));

-- Los cuatro riesgos que producen la clasificación (secciones 5.1-5.4).
-- Niveles: low | low_after_measures (bajo después de medidas) | high | very_high
alter table assessments
  add column risk_global_stability text
    check (risk_global_stability in ('low', 'low_after_measures', 'high', 'very_high')),
  add column risk_geotechnical text
    check (risk_geotechnical in ('low', 'low_after_measures', 'high', 'very_high')),
  add column risk_structural text
    check (risk_structural in ('low', 'low_after_measures', 'high', 'very_high')),
  add column risk_nonstructural text
    check (risk_nonstructural in ('low', 'low_after_measures', 'high', 'very_high')),
  add column derived_result text                -- lo que dio el algoritmo (nunca site_visit)
    check (derived_result in ('green', 'yellow', 'orange', 'red')),
  add column override_justification text,       -- obligatorio si result <> derived_result
  add column safety_measures jsonb,             -- secciones 5.x y 9, multi-selección
  add column specialist_visit jsonb;            -- estructural | geotécnico | serv. públicos

-- Si el revisor se desvía del resultado derivado, tiene que justificarlo
alter table assessments add constraint override_needs_reason
  check (result = derived_result or override_justification is not null);

-- ── cases: campos del Formulario Único AIS ───────────────────────────────────

alter table cases
  -- sección 2: tipo de inspección
  add column inspection_type text
    check (inspection_type in ('exterior', 'partial', 'complete', 'not_inspected')),
  add column not_inspected_reason text          -- solo si not_inspected
    check (not_inspected_reason in
      ('not_allowed', 'unoccupied', 'collapse', 'demolished', 'other')),
  -- sección 1: identificación catastral (sector-manzana-predio-mejora, IGAC)
  add column cadastral_id text,
  add column commune text,
  -- sección 3: identificación de la edificación
  add column building_name text,
  add column building_use int check (building_use between 1 and 11),      -- códigos AIS
  add column ground_floor_use int check (ground_floor_use between 1 and 11),
  add column floors_above int check (floors_above >= 1),                  -- niveles sobre terreno
  add column basements int check (basements >= 0),
  add column front_m numeric check (front_m > 0),
  add column depth_m numeric check (depth_m > 0),
  -- sección 4: descripción de la estructura (códigos AIS)
  add column structural_system text check (structural_system in
    ('11', '12', '13', '14',            -- concreto: pórtico, muros, dual, prefabricado
     '21', '22', '23',                  -- mampostería: confinada, reforzada, no reforzada
     '31', '32', '33',                  -- acero: arriostrado, no arriostrado, celosía
     '41', '42',                        -- madera
     '51', '52',                        -- bahareque, tapia
     '50', '60')),                      -- mixta, otros
  add column floor_system text check (floor_system in
    ('11', '12', '13',                  -- concreto: maciza, aligerada, reticular
     '21', '22', '23',                  -- acero: alma llena c/ y s/ conectores, cerchas
     '31', '32',                        -- madera: vigas, cerchas
     '40', '50')),                      -- mixta, otros
  add column year_range int check (year_range between 1 and 4),
    -- 1 <1950 | 2 1950-1982 | 3 1982-1997 | 4 >=1998 (cortes de los códigos sismorresistentes)
  -- secciones 5-6: daño (el detalle estructural va por elemento en el piso de mayor daño)
  add column worst_damaged_floor int,
  add column global_damage_pct text check (global_damage_pct in
    ('none', '0_10', '10_30', '30_60', '60_100', '100')),  -- sección 6: rango, no número
  add column structural_damage jsonb,           -- 5.3: matriz elemento × nivel × %extensión
  add column nonstructural_damage jsonb,        -- 5.4: 10 elementos × 5 niveles
  add column geotechnical jsonb,                -- 5.2: asentamientos, taludes, morfología
  -- secciones 8, 10-12
  add column preexisting jsonb,                 -- sección 8, variables A..I
  add column occupancy jsonb,                   -- secciones 10 y 11 (¡incluye dato sensible de salud!)
  add column contact jsonb;                     -- sección 12 ⚠️ PII (cédula+teléfono): RLS restringida (T6)

-- num_floors queda obsoleto: el AIS separa niveles sobre terreno y sótanos
update cases set floors_above = num_floors where num_floors >= 1;
alter table cases drop column num_floors;

-- warning_signs se conserva como señales rápidas para la IA (fase 2), pero el
-- registro de daño oficial es structural_damage / nonstructural_damage.
