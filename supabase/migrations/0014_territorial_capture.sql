-- Bloque de ubicación del formulario (HANDOFF-T5b): tipo de zona, flag de
-- barrio no listado, polígonos territoriales y columnas derivadas de gabinete.
--
-- El GPS es la fuente de verdad; lo que el brigadista capturó (municipality,
-- commune, neighborhood) NO se sobreescribe nunca — los valores calculados
-- por ST_Contains van en columnas *_derived aparte (auditoría).

alter table cases
  add column division_type text
    check (division_type in ('urban', 'rural')),
  add column neighborhood_unlisted boolean not null default false,
  add column commune_derived text,
  add column neighborhood_derived text;

-- cases tiene grants de SELECT por columna (0006): toda columna nueva
-- necesita el suyo o los selects que la pidan fallan con 403.
grant select (division_type, neighborhood_unlisted,
              commune_derived, neighborhood_derived)
  on cases to authenticated;

-- Polígonos de comunas/corregimientos (level=division) y barrios/veredas
-- (level=neighborhood). `code` usa los MISMOS slugs que kobo/media/*.csv
-- (divisiones.csv y barrios.csv) — mantenerlos idénticos al cargar los
-- shapefiles/GeoJSON de los geoportales (IDESC, Pereira).
create table territorial_divisions (
  code              text primary key,
  name              text not null,
  municipality_code text not null,      -- código DIVIPOLA del municipio
  level             text not null
    check (level in ('division', 'neighborhood')),
  parent_code       text references territorial_divisions (code),
  geom              geometry(multipolygon, 4326)
);

create index territorial_divisions_geom_idx
  on territorial_divisions using gist (geom);

-- RLS activo y cerrado por defecto, como el resto del esquema; la carga de
-- polígonos y el post-proceso corren con service role / en gabinete.
alter table territorial_divisions enable row level security;

-- Post-proceso en gabinete (HANDOFF-T5b.4): NO es parte del webhook — los
-- polígonos pueden no estar cargados aún y el webhook nunca debe fallar por
-- eso. Escribe *_derived solo cuando el polígono aporta información (difiere
-- de lo capturado, o el barrio venía como texto libre "OTRO").
-- Batch:
--   select assign_territorial_division(id) from cases where location is not null;
create or replace function assign_territorial_division(p_case_id uuid)
returns void
language plpgsql
as $$
declare
  v_loc            geometry;
  v_commune        text;
  v_neighborhood   text;
  v_unlisted       boolean;
  v_division_code  text;
  v_barrio_code    text;
  v_barrio_parent  text;
begin
  select location::geometry, commune, neighborhood, neighborhood_unlisted
    into v_loc, v_commune, v_neighborhood, v_unlisted
    from cases where id = p_case_id;

  if v_loc is null then
    return;
  end if;

  select code, parent_code into v_barrio_code, v_barrio_parent
    from territorial_divisions
    where level = 'neighborhood' and geom is not null
      and st_contains(geom, v_loc)
    limit 1;

  select code into v_division_code
    from territorial_divisions
    where level = 'division' and geom is not null
      and st_contains(geom, v_loc)
    limit 1;

  -- el padre del barrio es más preciso que el polígono de división suelto
  v_division_code := coalesce(v_barrio_parent, v_division_code);

  update cases set
    commune_derived = case
      when v_division_code is not null
       and v_division_code is distinct from v_commune
      then v_division_code else null end,
    neighborhood_derived = case
      when v_barrio_code is not null
       and (v_unlisted or v_barrio_code is distinct from v_neighborhood)
      then v_barrio_code else null end
  where id = p_case_id;
end;
$$;
