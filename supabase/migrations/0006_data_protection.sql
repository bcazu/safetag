-- Protección de datos personales (Ley 1581 de 2012) — HANDOFF T6.
-- Ver docs/politica-datos.md y docs/marco-normativo-y-negocio.md §3.3.
--
-- PII en cases: `contact` (cédula + teléfono, sección 12) y `occupancy`
-- (heridos/fallecidos = dato sensible de salud, sección 10).
-- Defensa en profundidad: además del RLS (hoy cerrado por defecto), se
-- retiran esas columnas del grant de SELECT de `authenticated`, para que
-- ninguna política futura de lectura de casos pueda exponerlas por accidente.
-- El acceso PMU / revisor asignado se dará por vista o función security
-- definer cuando exista el modelo de roles.

revoke select on cases from authenticated;
grant select (
  id, kobo_submission_id, location, address, neighborhood,
  construction_system, warning_signs, priority, status, created_at,
  inspection_type, not_inspected_reason, cadastral_id, commune,
  building_name, building_use, ground_floor_use, floors_above, basements,
  front_m, depth_m, structural_system, floor_system, year_range,
  worst_damaged_floor, global_damage_pct, structural_damage,
  nonstructural_damage, geotechnical, preexisting
  -- excluidas a propósito: contact, occupancy
) on cases to authenticated;

-- ── Ubicación de brigadistas ────────────────────────────────────────────────

-- Consentimiento explícito antes de activar el rastreo "en misión":
-- la app lo registra al aceptar; la BD lo exige.
alter table brigade_members
  add column location_consent_at timestamptz;

alter table brigade_members add constraint on_mission_needs_consent
  check (status <> 'on_mission' or location_consent_at is not null);

-- TTL real de 24 h para el rastro de posiciones (antes solo estaba "previsto").
-- pg_cron corre cada hora; cron.schedule con el mismo nombre es upsert,
-- así que la migración es re-aplicable (db reset).
create extension if not exists pg_cron;

select cron.schedule(
  'brigade-locations-ttl',
  '17 * * * *',
  $$delete from brigade_locations where reported_at < now() - interval '24 hours'$$
);
