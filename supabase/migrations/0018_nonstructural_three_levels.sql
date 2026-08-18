-- El riesgo NO estructural tiene solo TRES niveles — tabla 3-21 del manual
-- AIS, verificada en docs/manual-ais-tablas-verificadas.md. La 0004 lo creó
-- con los cuatro niveles genéricos ('very_high' incluido) antes de tener la
-- fuente primaria; se corrige el check para que los dictámenes nuevos no
-- puedan registrar un nivel que la metodología no contempla.
--
-- Los dictámenes son INMUTABLES: no se hace UPDATE de filas históricas que
-- pudieran traer 'very_high'. Por eso el constraint nuevo entra con NOT VALID:
-- Postgres lo aplica a inserts/updates futuros sin re-validar (ni invalidar)
-- las filas existentes. deriveHabitability (packages/rules) sigue aceptando
-- 'very_high' defensivamente para esos datos legados.

alter table assessments
  drop constraint if exists assessments_risk_nonstructural_check;

alter table assessments
  add constraint assessments_risk_nonstructural_check
    check (risk_nonstructural in ('low', 'low_after_measures', 'high'))
    not valid;
