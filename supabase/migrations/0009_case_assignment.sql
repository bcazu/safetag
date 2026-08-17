-- Asignación de casos: evita que dos revisores dictaminen el mismo caso en
-- paralelo. El reclamo es atómico por condición de estado (update ... where
-- status = 'pending'): el que llega segundo actualiza cero filas.
alter table cases
  add column assigned_reviewer_id uuid references reviewers(id),
  add column assigned_at timestamptz;

-- coherencia: un caso en revisión siempre tiene asignado, y viceversa
alter table cases add constraint in_review_needs_assignee
  check (status <> 'in_review' or assigned_reviewer_id is not null);

-- los revisores activos pueden reclamar/soltar (además del status ya otorgado)
grant update (assigned_reviewer_id, assigned_at) on cases to authenticated;
