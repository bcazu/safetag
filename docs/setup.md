# Guía de configuración de servicios

Paso a paso para dejar operativa la infraestructura del MVP. Orden recomendado:
Supabase → Edge Function → KoboToolbox → mapas → Vercel. Los pasos marcados
**[manual]** requieren navegador/cuenta propia; el resto se hace con CLI desde
el repo.

---

## 1. Supabase

### 1.1 Crear el proyecto [manual]

1. Cuenta en <https://supabase.com> (login con GitHub).
2. **New project** → organización personal:
   - Nombre: `safetag`
   - Database password: generar una fuerte y guardarla en tu gestor de claves
     (se necesita para `supabase link`).
   - Región: **South America (São Paulo)** — la más cercana a Colombia.
3. En **Project Settings → API**, copiar:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - El `project-ref` es el subdominio de la URL (también visible en la URL del dashboard).

### 1.2 Vincular el CLI y aplicar el esquema

El CLI ya está instalado como dev dependency (`pnpm exec supabase`).

```sh
pnpm exec supabase login          # abre navegador, pega el token
pnpm exec supabase link --project-ref <project-ref>   # pide la DB password
pnpm exec supabase db push        # aplica supabase/migrations/0001_schema.sql
```

Verificar en el dashboard (**Database → Tables**) que existen `cases`, `photos`,
`assessments`, `reviewers`, `brigade_members`, `brigade_locations`, `alerts`, y
que PostGIS aparece en **Database → Extensions**.

> Nota: RLS está habilitado en todas las tablas pero **sin políticas aún** —
> nadie puede leer/escribir con la anon key hasta la migración de políticas
> por rol. Es intencional: cerrado por defecto. Los grants de DML por rol
> están en `0002_grants.sql` (los proyectos nuevos de Supabase no los dan
> por defecto).

### 1.3 Storage para fotos

El bucket `photos` (privado, 5 MB máx., solo imágenes) se crea con la
migración `0003_storage.sql` — lo aplica el mismo `db push`, no hay paso
manual. Verificar en **Storage** del dashboard que existe.

### 1.4 Desplegar la Edge Function del webhook

```sh
# Secreto compartido con Kobo (generarlo, guardarlo, y ponerlo también en el paso 2.3)
openssl rand -hex 32
pnpm exec supabase secrets set KOBO_WEBHOOK_SECRET=<el-secreto>

# Token de la API de Kobo, para descargar las fotos adjuntas
# (KoboToolbox → Account Settings → Security → API Key)
pnpm exec supabase secrets set KOBO_API_TOKEN=<token-de-kobo>

# --no-verify-jwt: Kobo no envía JWT de Supabase; autentica con el secreto propio
pnpm exec supabase functions deploy kobo-webhook --no-verify-jwt
```

Sin `KOBO_API_TOKEN` el webhook guarda el caso pero omite las fotos (queda
un warning en los logs de la función).

La URL resultante es:
`https://<project-ref>.supabase.co/functions/v1/kobo-webhook`

Probar con un POST sintético:

```sh
curl -X POST https://<project-ref>.supabase.co/functions/v1/kobo-webhook \
  -H "content-type: application/json" \
  -H "x-webhook-secret: <el-secreto>" \
  -d '{"_id": 1, "_geolocation": [4.813, -75.696], "direccion": "Cra 7 # 18-20", "barrio": "Centro"}'
```

Debe responder `ok` y aparecer una fila en `cases`.

---

## 2. KoboToolbox

### 2.1 Cuenta y proyecto [manual]

1. Cuenta gratuita en <https://kf.kobotoolbox.org> (servidor global; el plan
   Community es suficiente y para uso humanitario hay límites ampliados —
   solicitar el plan humanitario desde el perfil si el volumen crece).
2. **New project → Upload an XLSForm** → subir `kobo/atc20.xlsx` → **Deploy**.

### 2.2 Formulario ATC-20

El formulario completo vive en `kobo/atc20.xlsx` (campos, listas de opciones
y mapeo al esquema documentados en `kobo/README.md`). Incluye GPS automático
en segundo plano (`start-geopoint`) como respaldo del geopoint manual y
compresión de fotos client-side (`max-pixels`).

### 2.3 Webhook hacia Supabase [manual]

1. En el proyecto de Kobo: **Settings → REST Services → Register a New Service**.
2. Endpoint URL: `https://<project-ref>.supabase.co/functions/v1/kobo-webhook`
3. Tipo: JSON.
4. **Custom HTTP Headers**: `x-webhook-secret` = el secreto del paso 1.4.
5. Enviar un submission de prueba desde el navegador (**Collect data → Open**)
   y verificar que llega a la tabla `cases`.

> Los nombres de campo del XLSForm deben coincidir con los que mapea
> `supabase/functions/kobo-webhook/index.ts` — ajustar el TODO de esa función
> cuando el formulario esté cerrado.

### 2.4 KoboCollect en Android [manual]

1. Instalar **KoboCollect** desde Play Store en los teléfonos de brigada.
2. Configuración → Server: `https://kc.kobotoolbox.org` + usuario/contraseña
   (o escanear el QR del proyecto).
3. Descargar el formulario y probar el ciclo completo offline: modo avión →
   llenar con fotos → volver a conectar → verificar sincronización y webhook.

---

## 3. Mapas

Sin cuentas ni configuración para desarrollo; decisión solo en producción.

- **Desarrollo**: tiles de `tile.openstreetmap.org` — permitido para dev,
  prohibido para producción con tráfico.
- **Producción (elegir uno, cambiar = cambiar una URL):**
  - **OpenFreeMap** (<https://openfreemap.org>): gratis, sin API key ni
    registro, sin límites publicados. Opción por defecto.
  - **Stadia Maps**: gratis para proyectos no comerciales, requiere cuenta y
    API key (`VITE_STADIA_API_KEY`); escribirles puede dar patrocinio para
    respuesta a desastres.
- Dependencias (se instalan al empezar la vista de mapa):
  `pnpm --filter web add leaflet react-leaflet leaflet.markercluster`
- Atribución obligatoria en el mapa: `© OpenStreetMap contributors` + el
  proveedor de tiles.

---

## 4. Vercel

### 4.1 Cuenta y proyectos [manual]

1. Cuenta en <https://vercel.com> con login de GitHub (plan Hobby).
2. **Add New → Project → Import** `bcazu/safetag`, dos veces (un proyecto de
   Vercel por app):

| Proyecto Vercel | Root Directory | Framework |
|---|---|---|
| `safetag-web` | `apps/web` | Vite |
| `safetag-brigada` | `apps/brigada` | Vite |

3. En cada proyecto → **Settings → Environment Variables**: `VITE_SUPABASE_URL`
   y `VITE_SUPABASE_ANON_KEY` (la anon key es pública por diseño; la seguridad
   real la da RLS).

Con eso cada push a `main` despliega ambas apps y cada PR genera preview.

### 4.2 CLI (opcional, para deploys/logs desde terminal)

```sh
pnpm dlx vercel login
pnpm dlx vercel link --cwd apps/web
pnpm dlx vercel link --cwd apps/brigada
```

---

## 5. Desarrollo local (opcional pero recomendado)

Stack Supabase completo en Docker, sin tocar el proyecto hosted:

```sh
pnpm exec supabase init      # solo la primera vez, genera supabase/config.toml
pnpm exec supabase start     # Postgres+PostGIS, Auth, Storage, Studio local
pnpm exec supabase db reset  # aplica migraciones desde cero
pnpm exec supabase functions serve kobo-webhook --no-verify-jwt  # webhook local
```

Studio local: <http://localhost:54323>. Las apps apuntan al entorno local con
`VITE_SUPABASE_URL=http://localhost:54321` y la anon key que imprime `start`.

---

## Checklist de verificación end-to-end

- [ ] `supabase db push` aplicó el esquema y PostGIS está activo
- [ ] Bucket `photos` creado (privado)
- [ ] Edge Function desplegada y el `curl` de prueba inserta en `cases`
- [ ] Formulario Kobo publicado con webhook + secreto configurado
- [ ] Submission real desde KoboCollect (offline → sync) aparece en `cases`
- [ ] Ambas apps desplegadas en Vercel con sus variables de entorno
- [ ] Decidido proveedor de tiles para producción (OpenFreeMap por defecto)

*Recordatorio del doc de diseño: antes de lanzar con datos reales, presentar
el proyecto al PMU/alcaldía o a la SCI.*
