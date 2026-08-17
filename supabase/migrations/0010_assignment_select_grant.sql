-- Fix de 0009: cases tiene SELECT por lista explícita de columnas (0006);
-- toda columna nueva debe añadirse al grant o los selects que la incluyan
-- fallan con 42501.
grant select (assigned_reviewer_id, assigned_at) on cases to authenticated;
