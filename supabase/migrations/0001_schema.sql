-- SafeTag — esquema núcleo (ver docs/stack-tecnico-mvp.md §5)
create extension if not exists postgis;

-- Casos de evaluación (poblados por webhook de Kobo)
create table casos (
  id uuid primary key default gen_random_uuid(),
  kobo_submission_id text unique,
  ubicacion geography(point),
  direccion text,
  barrio text,
  sistema_constructivo text,
  num_pisos int,
  senales_alarma jsonb,
  prioridad int not null default 50,          -- manual v1, IA fase 2
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'en_revision', 'dictaminado')),
  created_at timestamptz not null default now()
);

create table fotos (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id),
  storage_path text not null,
  tipo_foto text,
  exif_gps geography(point),
  ia_detecciones jsonb
);

create table revisores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nombre text not null,
  matricula_profesional text not null,
  verificado boolean not null default false
);

create table dictamenes (
  id uuid primary key default gen_random_uuid(),
  caso_id uuid not null references casos(id),
  revisor_id uuid not null references revisores(id),
  resultado text not null
    check (resultado in ('verde', 'amarillo', 'rojo', 'visita_presencial')),
  observaciones text,
  firmado_at timestamptz not null default now()
);

create table brigadistas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  nombre text not null,
  telefono text,
  estado text not null default 'fuera'
    check (estado in ('activo', 'en_mision', 'fuera'))
);

create table ubicaciones_brigada (
  id uuid primary key default gen_random_uuid(),
  brigadista_id uuid not null references brigadistas(id),
  posicion geography(point) not null,
  reportado_at timestamptz not null default now()
);

create table alertas (
  id uuid primary key default gen_random_uuid(),
  brigadista_id uuid not null references brigadistas(id),
  tipo text not null check (tipo in ('panico', 'checkin_vencido')),
  posicion geography(point),
  created_at timestamptz not null default now(),
  atendida_por uuid references auth.users(id),
  atendida_at timestamptz
);

create index casos_ubicacion_idx on casos using gist (ubicacion);
create index casos_estado_idx on casos (estado, prioridad desc);
create index ubicaciones_brigada_reportado_idx on ubicaciones_brigada (reportado_at);

-- RLS: revisores leen casos y escriben solo sus dictámenes; brigadistas
-- escriben solo su ubicación/alertas; rol PMU lee todo; nadie borra (auditoría).
-- Políticas concretas en la migración 0002 cuando se definan los roles en Auth.
alter table casos enable row level security;
alter table fotos enable row level security;
alter table dictamenes enable row level security;
alter table revisores enable row level security;
alter table brigadistas enable row level security;
alter table ubicaciones_brigada enable row level security;
alter table alertas enable row level security;
