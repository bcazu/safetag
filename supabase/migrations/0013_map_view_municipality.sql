-- La vista del mapa expone el municipio para el filtro jerárquico (backlog #2).
-- drop+create: "create or replace view" no permite insertar columnas en medio.
drop view if exists map_cases;

create view map_cases
with (security_invoker = true) as
select
  c.id,
  c.address,
  c.municipality,
  c.commune,
  c.neighborhood,
  c.status,
  c.priority,
  c.building_use,
  st_y(c.location::geometry) as lat,
  st_x(c.location::geometry) as lng,
  last_assessment.result,
  last_assessment.signed_at
from cases c
left join lateral (
  select a.result, a.signed_at
  from assessments a
  where a.case_id = c.id
  order by a.signed_at desc
  limit 1
) last_assessment on true
where c.location is not null;

grant select on map_cases to authenticated, service_role;
