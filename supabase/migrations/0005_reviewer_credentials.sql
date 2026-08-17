-- Credenciales profesionales de revisores (Ley 842 de 2003).
-- Ver docs/HANDOFF.md (T2) y docs/marco-normativo-y-negocio.md §3.2.
--
-- La matrícula es condición de validez del dictamen: hay que guardar la rama
-- (art. 19: la especialidad debe corresponder a la materia del dictamen),
-- verificarla contra COPNIA, y re-verificarla periódicamente (una matrícula
-- suspendida inhabilita al revisor).

alter table reviewers
  add column license_branch text,               -- rama de la matrícula (Ley 842 art. 19)
  add column license_verified_at timestamptz,   -- última verificación contra COPNIA
  add column license_status text not null default 'unverified'
    check (license_status in ('unverified', 'active', 'suspended')),
  add column specialty text
    check (specialty in ('structural', 'geotechnical', 'general')),
  add column can_recommend_demolition boolean not null default false;
    -- solo perfiles con experiencia en diseño/patología estructural (manual AIS)

-- `verified` queda reemplazado por license_status + license_verified_at
-- (el booleano no decía contra qué se verificó)
alter table reviewers drop column verified;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Regla dura: un revisor sin matrícula activa no puede emitir dictámenes.
-- Se implementa como política (el cliente puede mentir; la BD no).

-- Cada revisor puede leer su propia fila (necesario además para que el EXISTS
-- de la política de assessments pase el RLS de reviewers).
create policy reviewers_select_own on reviewers
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Insertar un dictamen exige: ser el revisor firmante y tener matrícula activa.
create policy assessments_insert_active_reviewer on assessments
  for insert to authenticated
  with check (
    exists (
      select 1 from reviewers r
      where r.id = reviewer_id
        and r.user_id = (select auth.uid())
        and r.license_status = 'active'
    )
  );
