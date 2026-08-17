-- Políticas RLS para el flujo de revisión (/revisar) — HANDOFF T4 + modelo
-- "revisores leen casos y escriben solo sus dictámenes; nadie borra".
-- El rol PMU (lee todo, incluida PII vía vista dedicada) llegará cuando se
-- defina el modelo de roles; mientras tanto todo acceso PMU va por
-- service_role desde tooling propio.

-- Revisores: registro propio. Nadie puede autoactivarse: la fila nace
-- 'unverified' y solo un admin (service_role) cambia license_status.
create policy reviewers_insert_self on reviewers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and license_status = 'unverified'
  );

-- Casos: cualquier revisor registrado lee la cola (la PII contact/occupancy
-- ya está excluida por grant de columna en 0006).
create policy cases_select_reviewers on cases
  for select to authenticated
  using (
    exists (select 1 from reviewers r where r.user_id = (select auth.uid()))
  );

-- Casos: solo revisores con matrícula activa mueven el estado — y SOLO el
-- estado (grant por columna; el contenido del caso es del brigadista/webhook).
revoke update on cases from authenticated;
grant update (status) on cases to authenticated;

create policy cases_update_status_active_reviewer on cases
  for update to authenticated
  using (
    exists (
      select 1 from reviewers r
      where r.user_id = (select auth.uid()) and r.license_status = 'active'
    )
  )
  with check (
    exists (
      select 1 from reviewers r
      where r.user_id = (select auth.uid()) and r.license_status = 'active'
    )
  );

-- Fotos: metadatos legibles por revisores registrados
create policy photos_select_reviewers on photos
  for select to authenticated
  using (
    exists (select 1 from reviewers r where r.user_id = (select auth.uid()))
  );

-- Dictámenes: cada revisor lee los propios (auditoría completa = PMU/service)
create policy assessments_select_own on assessments
  for select to authenticated
  using (
    exists (
      select 1 from reviewers r
      where r.id = reviewer_id and r.user_id = (select auth.uid())
    )
  );

-- Storage: los revisores leen los archivos del bucket photos (necesario para
-- generar URLs firmadas desde el cliente)
create policy photos_bucket_read_reviewers on storage.objects
  for select to authenticated
  using (
    bucket_id = 'photos'
    and exists (select 1 from reviewers r where r.user_id = (select auth.uid()))
  );
