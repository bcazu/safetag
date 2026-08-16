# Stack Técnico — Plataforma de Triage Estructural Post-Sismo

> MVP diseñado para crecer. Principio rector: **no construir lo que ya está resuelto** (captura offline = KoboToolbox), desarrollar solo donde aportamos valor único (revisión remota, priorización, seguridad de brigadistas).

---

## 1. Vista general de la arquitectura

```
┌─────────────── CAMPO ───────────────┐      ┌────────── SERVIDOR ──────────┐      ┌──────── REMOTO ────────┐
│                                     │      │                              │      │                        │
│  KoboCollect (Android, offline)     │      │  Supabase                    │      │  App React (Vercel)    │
│  └─ Formulario ATC-20 + fotos  ─────┼──────▶  ├─ Edge Function (webhook)  │      │  ├─ /revisar (cola)    │
│                                     │      │  ├─ Postgres + PostGIS       ◀──────┼──┤                     │
│  PWA Brigada (seguridad)            │      │  ├─ Storage (fotos)          │      │  ├─ /mapa (dashboard)  │
│  ├─ Botón de pánico            ─────┼──────▶  ├─ Realtime (websockets)    ──────▶│  └─ /brigadas (monitor)│
│  ├─ Compartir ubicación en vivo     │      │  └─ Auth + RLS (roles)       │      │                        │
│  └─ Check-in periódico              │      │                              │      │                        │
│                                     │      │  [Fase 2] FastAPI + YOLO     │      │                        │
└─────────────────────────────────────┘      └──────────────────────────────┘      └────────────────────────┘
```

Dos apps en campo, cada una haciendo lo que mejor sabe:
- **KoboCollect** captura las evaluaciones (offline robusto, ya resuelto, cero desarrollo).
- **PWA Brigada** (nuestra, ligera) cubre la seguridad del brigadista: pánico, ubicación, check-in.

---

## 2. Stack por capa

### Backend — Supabase

| Componente | Uso | Por qué |
|---|---|---|
| **Postgres + PostGIS** | Base de datos de casos, dictámenes, brigadistas | El dominio es geoespacial: "rojos cerca de escuelas", clustering, avance por barrio son queries nativas |
| **Auth + Row Level Security** | Roles: brigadista / revisor / admin PMU | Un revisor solo ve su cola; el PMU ve todo. Seguridad a nivel de fila, no de código |
| **Storage** | Fotos de evaluaciones | URLs firmadas, integrado con RLS |
| **Realtime** | Cola de revisión en vivo, ubicaciones de brigadas, alertas de pánico | Websockets sin infraestructura propia |
| **Edge Functions** | Webhook de Kobo → insertar caso; disparo de alertas | Serverless, TypeScript/Deno |

> Escalabilidad: Supabase es Postgres open source → si el proyecto se institucionaliza, la alcaldía puede auto-hospedarlo (soberanía de datos). Nada nos ata al proveedor.

### Captura de evaluaciones — KoboToolbox

| Componente | Uso |
|---|---|
| **Editor XLSForm** | Formulario ATC-20 adaptado, con lógica condicional y fotos obligatorias |
| **KoboCollect (Android)** | Captura 100% offline: formulario, GPS y fotos guardados localmente, sincronización automática al recuperar señal |
| **REST API + webhooks** | Cada envío dispara la Edge Function que puebla Supabase |

> El estándar XLSForm es portable a ArcGIS Survey123 sin reescribir nada, si la alianza con la alcaldía lo pide (posibles licencias ESRI vía Programa de Respuesta a Desastres).

### Frontend — React

| Herramienta | Uso |
|---|---|
| **React 18 + Vite + TypeScript** | Base de las apps web |
| **TanStack Query** | Estado del servidor, caché, reintentos |
| **shadcn/ui + Tailwind** | UI rápida y consistente |
| **supabase-js** | Cliente de datos, auth y realtime |
| **Vercel** | Deploy con CI/CD desde GitHub |

### Mapas y visualización

| Herramienta | Uso | Por qué |
|---|---|---|
| **Leaflet + react-leaflet** | Mapa base de todas las vistas (dashboard, monitor de brigadas, visor de caso) | Simple, liviano (~42 KB), API madura, corre sin WebGL en equipos modestos. Nuestro caso — marcadores semáforo, popups, filtros — es su territorio clásico |
| **Leaflet.markercluster** | Clustering de miles de puntos | Plugin estándar, probado por años |
| **Leaflet.heat** (opcional) | Heatmap de densidad de daños | Una línea de integración |
| **Datos OpenStreetMap** | Cartografía base | Gratis; además la zona se actualiza rápido con el mapeo humanitario post-sismo (HOT) |
| **Tiles: OpenFreeMap / Carto / Stadia Maps** | Servidor de tiles en producción | ⚠️ Los tiles oficiales de tile.openstreetmap.org tienen política de uso: sirven para desarrollo, no para producción con tráfico. Estos proveedores basados en OSM tienen tiers gratuitos generosos (Stadia es gratis para proyectos no comerciales y podría patrocinar respuesta a desastres). Cambiar de proveedor = cambiar una URL |
| **Supabase PostGIS → GeoJSON** | Capa de casos semáforo | Query directa, sin ETL. Leaflet consume GeoJSON nativamente |
| **Recharts** | Gráficos del dashboard (avance por zona, casos/día) | Simple, ya en el ecosistema React |

> **Ruta de crecimiento:** si la fase 2 exigiera visualizaciones que Leaflet no da (vector tiles, 3D, decenas de miles de puntos animados), migrar a MapLibre GL + deck.gl no toca el backend: ambos consumen el mismo GeoJSON desde PostGIS. Improbable que haga falta.

### IA (Fase 2) — Python

| Herramienta | Uso |
|---|---|
| **FastAPI** | Microservicio de inferencia: recibe URL de foto → devuelve detecciones + score de prioridad |
| **Ultralytics YOLO (nano/small)** | Detección de grietas y patrones de alarma |
| **SDNET2018 + fotos reales del sismo** | Dataset de fine-tuning |
| **Raspberry Pi + AI HAT+ 2** | Banco de pruebas del pipeline antes de desplegar |
| **Docker → Fly.io / Railway / Cloud Run** | Deploy del microservicio |

---

## 3. PWA Brigada — offline, cámara y seguridad

### ¿Por qué una PWA y no app nativa?

Sin tiendas de apps ni proceso de aprobación: se comparte un link/QR y funciona en Android y iPhone. Instalable en pantalla de inicio. Suficiente acceso a GPS y cámara para nuestras necesidades.

### Soporte offline

- **Service Worker + Workbox**: la app completa (código, assets, mapa base de la zona) se cachea en la primera carga → abre sin señal.
- **IndexedDB (librería Dexie.js)**: cola local de eventos pendientes (check-ins, alertas, fotos) cuando no hay red.
- **Background Sync**: al recuperar señal, la cola se envía automáticamente aunque la app esté cerrada (Android/Chrome; en iOS se sincroniza al abrir).
- Patrón general: **local-first** — todo se escribe primero en el dispositivo, la red es oportunista.

> Nota honesta: la captura de evaluaciones con fotos pesadas offline ya la resuelve KoboCollect con años de madurez. La PWA solo maneja eventos ligeros (ubicación, alertas, check-ins) offline, que es un problema mucho más simple y confiable en web.

### Cámara y fotos

- **En Kobo (evaluaciones):** KoboCollect usa la cámara nativa del sistema — calidad completa, sin desarrollo nuestro.
- **En la PWA (si se necesita foto rápida, p. ej. adjunta a una alerta):** `<input type="file" capture="environment">` abre la cámara nativa directamente. Compresión client-side antes de subir (canvas → WebP/JPEG ~1600px) para redes débiles. EXIF con geolocalización preservado.
- Fase 3 (PWA de captura propia, solo si se decide reemplazar Kobo): `getUserMedia` para cámara embebida con overlay de guía ("encuadre la fachada completa"), lo cual permite secuencias de foto guiadas dentro de la app.

### Features de seguridad del brigadista (van en el MVP)

El contexto lo justifica: brigadistas entrando a zonas con estructuras dañadas y réplicas activas.

1. **Botón de pánico** — botón grande, siempre visible, activable con pantalla bloqueada difícil pero con confirmación anti-toque-accidental (mantener presionado 2 s). Al activarse:
   - Envía alerta con GPS + timestamp + identidad a Supabase Realtime.
   - El monitor de brigadas (/brigadas) la muestra al instante con sonido.
   - **Fallback sin datos móviles:** abre el marcador con 123 (línea de emergencia) y genera SMS pre-escrito con coordenadas — porque en zona de desastre la red de datos puede estar caída pero SMS/voz suelen sobrevivir.
   - Si está offline total: la alerta queda en cola y se envía al recuperar señal, marcada con la hora real del evento.

2. **Compartir ubicación en vivo** — el brigadista activa "en misión" y la PWA reporta posición cada 2–5 min (Geolocation API + envío batched para ahorrar batería). El coordinador ve todas las brigadas en el mapa. Se apaga automáticamente al terminar turno (privacidad por diseño: solo durante misión activa).

3. **Check-in periódico ("hombre muerto")** — cada 45 min la app pide confirmar "estoy bien" con un toque. Si no responde en 15 min adicionales, alerta amarilla automática al coordinador con última ubicación conocida. Es el estándar de seguridad en trabajo de campo humanitario.

4. **Info de zona** — al entrar a evaluar, la PWA muestra si hay alerta de réplica vigente (feed del SGC) y los casos "rojos" ya dictaminados cerca de su posición (no entrar).

---

## 4. Features del MVP (alcance de la v1)

### App de Revisión (/revisar) — para ingenieros voluntarios
- [ ] Login con rol de revisor (matrícula profesional en el perfil)
- [ ] Cola de casos pendientes ordenada por prioridad (manual en v1, IA en fase 2)
- [ ] Visor de caso: fotos con zoom, datos del formulario, mapa de ubicación
- [ ] Dictamen: verde / amarillo / rojo / "requiere visita presencial" + observaciones + firma (nombre + matrícula + timestamp)
- [ ] Asignación simple: tomar caso ↔ liberar caso (evita revisión duplicada)

### Dashboard (/mapa) — para PMU / coordinación
- [ ] Mapa semáforo con clustering
- [ ] Filtros: estado, barrio, fecha, tipo de estructura
- [ ] Contadores: evaluados / pendientes / por dictamen
- [ ] Lista priorizada de rojos para visita presencial
- [ ] Export CSV/GeoJSON

### PWA Brigada — para personal de campo
- [ ] Botón de pánico (con fallback SMS/123)
- [ ] Ubicación en vivo durante misión
- [ ] Check-in periódico
- [ ] Link directo al formulario Kobo del sector asignado

### Monitor de brigadas (/brigadas) — para coordinador de campo
- [ ] Mapa en vivo de brigadistas activos
- [ ] Panel de alertas (pánico / check-in vencido) con sonido
- [ ] Registro de turnos

### Lo que NO va en v1 (a propósito)
- IA de priorización (fase 2 — el sistema funciona sin ella)
- Captura propia reemplazando Kobo (fase 3, solo si hay razón)
- Notificaciones push nativas (fase 2; en v1 el monitor vive abierto en el puesto de mando)
- App para habitantes consultando su resultado (fase 2)

---

## 5. Esquema de datos (núcleo)

Identificadores en inglés (convención); los campos del XLSForm de Kobo quedan
en español y el webhook hace el mapeo.

```sql
-- Casos de evaluación (poblados por webhook de Kobo)
cases (
  id uuid pk,
  kobo_submission_id text unique,
  location geography(point),       -- PostGIS
  address text,
  neighborhood text,
  construction_system text,
  num_floors int,
  warning_signs jsonb,             -- checklist del formulario
  priority int default 50,         -- manual v1, IA fase 2
  status text default 'pending',   -- pending | in_review | assessed
  created_at timestamptz
)

photos (id, case_id fk, storage_path, photo_type, exif_gps geography(point), ai_detections jsonb null)

-- Dictámenes firmados
assessments (id, case_id fk, reviewer_id fk, result text,  -- green|yellow|red|site_visit
             notes text, signed_at timestamptz)

reviewers (id, user_id fk auth.users, name, professional_license, verified bool)

brigade_members (id, user_id fk, name, phone, status text)  -- active | on_mission | off_duty

brigade_locations (id, brigade_member_id fk, position geography(point), reported_at)  -- TTL 24h

alerts (id, brigade_member_id fk, type text,  -- panic | missed_checkin
        position geography(point), created_at, handled_by fk null, handled_at null)
```

RLS: revisores leen casos y escriben solo sus dictámenes; brigadistas escriben solo su ubicación/alertas; rol PMU lee todo; nadie borra nada (auditoría).

---

## 6. Plan de ejecución

| Cuándo | Entregable |
|---|---|
| **Día 1** | Formulario ATC-20 en Kobo (XLSForm) · Proyecto Supabase con esquema y RLS |
| **Día 2–3** | Edge Function webhook Kobo→Supabase · App de revisión: cola + visor + dictamen |
| **Día 4** | Dashboard con mapa Leaflet · Deploy en Vercel · **Demo lista para alcaldía/SCI** |
| **Día 5–7** | PWA Brigada: pánico + ubicación + check-in · Monitor /brigadas |
| **Semana 2** | Validación del formulario con ingeniero estructural real · Auth y roles finos · Piloto con una brigada |
| **Fase 2** | Microservicio FastAPI + YOLO (prototipado en Raspberry) · Priorización automática · Push notifications · Consulta ciudadana |
| **Fase 3** | Monitoreo fijo de estructuras (Raspberry + AI Camera) · Segmentación U-Net para medición de grietas |

---

## 7. Costos del MVP

| Servicio | Plan | Costo |
|---|---|---|
| KoboToolbox | Humanitario | $0 |
| Supabase | Free tier (500 MB DB, 1 GB storage) → Pro si crece | $0 → $25/mes |
| Vercel | Hobby | $0 |
| Leaflet + tiles OSM (OpenFreeMap/Stadia) | Open source / tier gratuito | $0 |
| Dominio | — | ~$12/año |

El cuello real del free tier será el storage de fotos (1 GB ≈ 2.000–3.000 fotos comprimidas). Plan: compresión agresiva client-side y upgrade a Pro cuando el piloto valide.

---

*Actualizado: 15 de agosto de 2026.*
