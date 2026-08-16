-- Grants de DML: los proyectos nuevos de Supabase no otorgan privilegios
-- de tabla a los roles de la API por defecto (solo TRUNCATE/REFERENCES/TRIGGER).
--
-- Modelo de acceso:
--   service_role  → DML total; lo usan las Edge Functions (kobo-webhook).
--   authenticated → DML, pero RLS está habilitado sin políticas: cerrado por
--                   defecto hasta la migración de políticas por rol.
--   anon          → sin grants; se decidirá si el mapa público necesita lectura.

grant select, insert, update, delete on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Tablas futuras creadas por `postgres` (migraciones) heredan los mismos grants
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to service_role;
alter default privileges for role postgres in schema public
  grant select, insert, update, delete on tables to authenticated;
