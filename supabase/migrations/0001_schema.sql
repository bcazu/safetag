-- SafeTag — esquema núcleo (ver docs/stack-tecnico-mvp.md §5)
create extension if not exists postgis;

-- Casos de evaluación: una fila por edificación reportada desde campo.
-- Poblados por el webhook de Kobo (supabase/functions/kobo-webhook).
create table cases (
  id uuid primary key default gen_random_uuid(),
  kobo_submission_id text unique,             -- _id del submission de Kobo; unique = idempotencia ante reintentos del webhook
  location geography(point),                  -- geopoint del formulario; alimenta el mapa y queries PostGIS ("rojos cerca de escuelas")
  address text,                               -- dirección declarada por el brigadista, para ubicar en terreno
  neighborhood text,                          -- barrio (select_one del formulario); agrupa el avance por zona en el dashboard
  construction_system text,                   -- mampostería confinada/no confinada, pórticos, otro; contexto para el revisor
  num_floors int,                             -- número de pisos; factor de riesgo y contexto del dictamen
  warning_signs jsonb,                        -- checklist de señales de alarma (select_multiple), tal como llega de Kobo
  priority int not null default 50,           -- 0-100, ordena la cola de revisión; manual v1, calculada por IA en fase 2
  status text not null default 'pending'      -- ciclo de vida en la cola: pending → in_review → assessed
    check (status in ('pending', 'in_review', 'assessed')),
  created_at timestamptz not null default now()
);

-- Fotos de cada caso (fachada, esquinas, peor grieta, columnas).
-- El binario vive en Storage (bucket privado `photos`); aquí solo metadatos.
create table photos (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  storage_path text not null,                 -- ruta en el bucket; se sirve con URL firmada
  photo_type text,                            -- qué foto de la secuencia guiada es: fachada, esquina, grieta, columnas
  exif_gps geography(point),                  -- GPS del EXIF; contraste anti-fraude contra cases.location
  ai_detections jsonb                         -- salida del modelo de visión (grietas detectadas/medidas); null hasta fase 2
);

-- Ingenieros voluntarios que dictaminan remotamente.
create table reviewers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),  -- vínculo con Supabase Auth; base de las políticas RLS
  name text not null,
  professional_license text not null,         -- matrícula profesional (COPNIA); da validez legal al dictamen
  verified boolean not null default false     -- true cuando un admin validó la matrícula; solo verificados dictaminan
);

-- Dictámenes firmados: el veredicto semáforo de un revisor sobre un caso.
-- Un caso puede tener varios (segunda revisión); nunca se borran (auditoría).
create table assessments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id),
  reviewer_id uuid not null references reviewers(id),  -- quién firma; su matrícula respalda el dictamen
  result text not null                        -- semáforo ATC-20: green (habitable), yellow (uso restringido),
    check (result in ('green', 'yellow', 'red', 'site_visit')),  -- red (inseguro), site_visit (no dictaminable por fotos)
  notes text,                                 -- observaciones del ingeniero; obligatorias en la práctica para yellow/red
  signed_at timestamptz not null default now()
);

-- Brigadistas en campo (app de seguridad).
create table brigade_members (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),  -- vínculo con Supabase Auth; base de las políticas RLS
  name text not null,
  phone text,                                 -- contacto directo si hay alerta y la app no responde
  status text not null default 'off_duty'     -- active (disponible) | on_mission (en terreno, se monitorea) | off_duty
    check (status in ('active', 'on_mission', 'off_duty'))
);

-- Rastro de posiciones de brigadistas en misión (ping periódico de la PWA).
-- Datos efímeros: solo importan las últimas horas (TTL 24h vía job de limpieza).
create table brigade_locations (
  id uuid primary key default gen_random_uuid(),
  brigade_member_id uuid not null references brigade_members(id),
  position geography(point) not null,
  reported_at timestamptz not null default now()  -- clave para "última posición conocida" y para detectar silencio
);

-- Alertas de seguridad de brigadistas; disparan notificación al PMU.
create table alerts (
  id uuid primary key default gen_random_uuid(),
  brigade_member_id uuid not null references brigade_members(id),
  type text not null check (type in ('panic', 'missed_checkin')),  -- panic: botón manual; missed_checkin: check-in vencido (server)
  position geography(point),                  -- última posición al disparar; null si el dispositivo no la tenía
  created_at timestamptz not null default now(),
  handled_by uuid references auth.users(id),  -- operador PMU que atendió; null = alerta aún abierta
  handled_at timestamptz
);

create index cases_location_idx on cases using gist (location);          -- queries espaciales del mapa
create index cases_status_idx on cases (status, priority desc);          -- cola de revisión: pendientes por prioridad
create index brigade_locations_reported_idx on brigade_locations (reported_at);  -- última posición y limpieza TTL

-- RLS: revisores leen casos y escriben solo sus dictámenes; brigadistas
-- escriben solo su ubicación/alertas; rol PMU lee todo; nadie borra (auditoría).
-- Políticas concretas en una migración posterior cuando se definan los roles en Auth
-- (los grants de DML por rol están en 0002_grants.sql).
alter table cases enable row level security;
alter table photos enable row level security;
alter table assessments enable row level security;
alter table reviewers enable row level security;
alter table brigade_members enable row level security;
alter table brigade_locations enable row level security;
alter table alerts enable row level security;
