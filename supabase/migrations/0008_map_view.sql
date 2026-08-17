-- Vista para el mapa de la operación (/mapa) y lectura operativa de dictámenes.
--
-- Los dictámenes no contienen PII: son datos operativos que cualquier revisor
-- registrado del operativo puede ver (el semáforo del mapa los necesita).
-- La restricción fuerte sigue siendo de escritura (matrícula activa, 0005).
drop policy assessments_select_own on assessments;

create policy assessments_select_reviewers on assessments
  for select to authenticated
  using (
    exists (select 1 from reviewers r where r.user_id = (select auth.uid()))
  );

-- Vista con coordenadas planas y el último dictamen por caso.
-- security_invoker: aplica el RLS y los grants por columna del consultante
-- (la PII de cases sigue inaccesible; la vista ni la menciona).
create view map_cases
with (security_invoker = true) as
select
  c.id,
  c.address,
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
