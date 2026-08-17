-- Segmentación territorial (backlog #2): el sismo afecta varios municipios y
-- `commune` solo tenía sentido para Pereira. Jerarquía:
--   municipio (código DIVIPOLA, estable, exportable al RUD) → comuna → barrio
-- El departamento se deriva del prefijo del código (66 Risaralda, 76 Valle,
-- 27 Chocó): no se guarda aparte. Los nombres visibles viven en i18n.
alter table cases add column municipality text;

-- cases tiene SELECT por columna (0006): toda columna nueva necesita su grant
grant select (municipality) on cases to authenticated;

-- Backfill de los datos existentes (capturados cuando el formulario asumía
-- Pereira, o sintéticos con slug de ciudad en commune)
update cases set municipality = '76001', commune = null where commune = 'cali';
update cases set municipality = '27001', commune = null where commune = 'quibdo';
update cases set municipality = '66001' where municipality is null and commune is not null;
