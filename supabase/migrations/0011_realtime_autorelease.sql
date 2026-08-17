-- Coordinación en vivo de la cola de revisión (backlog #3).

-- Realtime: publicar cambios de `cases` para que quien tenga un caso abierto
-- se entere al instante si otro revisor lo toma (los eventos respetan RLS).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'cases'
  ) then
    alter publication supabase_realtime add table cases;
  end if;
end $$;

-- Auto-liberación: un caso tomado y sin dictamen en 2 horas vuelve a la cola
-- (revisor desconectado/abandonó). Corre cada 10 minutos.
select cron.schedule(
  'case-assignment-auto-release',
  '*/10 * * * *',
  $$update cases
      set status = 'pending', assigned_reviewer_id = null, assigned_at = null
    where status = 'in_review' and assigned_at < now() - interval '2 hours'$$
);
