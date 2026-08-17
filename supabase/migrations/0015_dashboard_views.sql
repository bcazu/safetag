-- Vistas agregadas para el dashboard de decisión (backlog #7).
--
-- security_invoker: la agregación corre bajo el RLS y los grants por columna
-- del consultante (revisor registrado). Ninguna vista toca columnas con PII
-- (contact/occupancy); solo conteos sobre datos operativos.
--
-- El enrutamiento por especialidad NO se calcula aquí: dashboard_routing
-- expone los hechos crudos (building_use, geotechnical) y la UI aplica
-- routeCase de packages/rules — la regla vive en un solo lugar.

-- Semáforo, estado y avance por territorio: una fila por combinación.
create view dashboard_territory
with (security_invoker = true) as
select
  c.municipality,
  c.commune,
  c.status,
  last_assessment.result,
  count(*)::int as n
from cases c
left join lateral (
  select a.result
  from assessments a
  where a.case_id = c.id
  order by a.signed_at desc
  limit 1
) last_assessment on true
group by 1, 2, 3, 4;

-- Hechos de enrutamiento (la UI aplica routeCase sobre cada fila).
create view dashboard_routing
with (security_invoker = true) as
select c.municipality, c.building_use, c.geotechnical, c.status,
       count(*)::int as n
from cases c
group by 1, 2, 3, 4;

-- Cola sin dictaminar por prioridad (0-100); el bandeo es presentación
-- y se hace en la UI.
create view dashboard_priority
with (security_invoker = true) as
select c.municipality, c.priority, count(*)::int as n
from cases c
where c.status in ('pending', 'in_review')
group by 1, 2;

-- Ritmo: casos recibidos y dictámenes firmados por día y municipio.
create view dashboard_daily
with (security_invoker = true) as
with created as (
  select c.created_at::date as day, c.municipality, count(*)::int as n
  from cases c
  group by 1, 2
), signed as (
  select a.signed_at::date as day, c.municipality, count(*)::int as n
  from assessments a
  join cases c on c.id = a.case_id
  group by 1, 2
)
select
  coalesce(created.day, signed.day) as day,
  coalesce(created.municipality, signed.municipality) as municipality,
  coalesce(created.n, 0) as cases_created,
  coalesce(signed.n, 0) as assessments_signed
from created
full join signed
  on signed.day = created.day
  and signed.municipality is not distinct from created.municipality;

-- Revisores activos: distintos firmantes en los últimos 7 días (global; un
-- revisor puede firmar en varios municipios, no se segmenta para no
-- sobrecontar).
create view dashboard_active_reviewers
with (security_invoker = true) as
select count(distinct a.reviewer_id)::int as active_7d
from assessments a
where a.signed_at > now() - interval '7 days';

grant select on dashboard_territory, dashboard_routing, dashboard_priority,
                dashboard_daily, dashboard_active_reviewers
  to authenticated, service_role;
