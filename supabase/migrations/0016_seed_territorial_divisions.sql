-- Siembra de comunas/corregimientos en territorial_divisions (nivel division)
-- espejo de kobo/media/divisiones.csv — MISMOS slugs (contrato T5b). La web
-- resuelve las etiquetas desde aquí (el slug compacto no es legible); los
-- polígonos (geom) se cargarán después desde los geoportales.
--
-- Lectura para revisores registrados: nombres de divisiones no son PII.
create policy territorial_divisions_select_reviewers on territorial_divisions
  for select to authenticated
  using (
    exists (select 1 from reviewers r where r.user_id = (select auth.uid()))
  );

insert into territorial_divisions (code, name, municipality_code, level) values
  ('66001-C-CENTRO',        'Comuna Centro',            '66001', 'division'),
  ('66001-C-RIOOTUN',       'Comuna Río Otún',          '66001', 'division'),
  ('66001-C-VILLAVICENCIO', 'Comuna Villavicencio',     '66001', 'division'),
  ('66001-C-VILLASANTANA',  'Comuna Villa Santana',     '66001', 'division'),
  ('66001-C-ORIENTE',       'Comuna Oriente',           '66001', 'division'),
  ('66001-C-UNIVERSIDAD',   'Comuna Universidad',       '66001', 'division'),
  ('66001-C-BOSTON',        'Comuna Boston',            '66001', 'division'),
  ('66001-C-JARDIN',        'Comuna Jardín',            '66001', 'division'),
  ('66001-C-CUBA',          'Comuna Cuba',              '66001', 'division'),
  ('66001-C-CONSOTA',       'Comuna Consotá',           '66001', 'division'),
  ('66001-C-ELOSO',         'Comuna El Oso',            '66001', 'division'),
  ('66001-C-SANJOAQUIN',    'Comuna San Joaquín',       '66001', 'division'),
  ('66001-C-PERLADELOTUN',  'Comuna Perla del Otún',    '66001', 'division'),
  ('66001-C-OLIMPICA',      'Comuna Olímpica',          '66001', 'division'),
  ('66001-C-FERROCARRIL',   'Comuna Ferrocarril',       '66001', 'division'),
  ('66001-C-DELCAFE',       'Comuna Del Café',          '66001', 'division'),
  ('66001-C-ELPOBLADO',     'Comuna El Poblado',        '66001', 'division'),
  ('66001-C-ELROCIO',       'Comuna El Rocío',          '66001', 'division'),
  ('66001-C-SANNICOLAS',    'Comuna San Nicolás',       '66001', 'division');

insert into territorial_divisions (code, name, municipality_code, level)
select format('76001-C%s', lpad(n::text, 2, '0')),
       format('Comuna %s', n), '76001', 'division'
from generate_series(1, 22) as n;

-- Filas de escape por municipio (los CSV las tienen para que ninguna lista
-- incompleta bloquee una evaluación)
insert into territorial_divisions (code, name, municipality_code, level)
select format('%s-C-OTRA', m), 'Otra comuna (no listada)', m, 'division'
from unnest(array['27001','27660','66001','66170','66400','66682','76001']) as m;

insert into territorial_divisions (code, name, municipality_code, level)
select format('%s-CO-OTRO', m), 'Otro corregimiento (no listado)', m, 'division'
from unnest(array['27001','27660','66001','66170','66400','66682','76001']) as m;
