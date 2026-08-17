# Pendientes — backlog de producto

> Registrado 16-ago-2026 a partir de la primera sesión de uso real de /revisar
> y /mapa. Complementa los pendientes normativos de `docs/HANDOFF.md` (T6
> parcial, revisión presencial, tablas AIS sin verificar).
>
> **Estado (17-ago-2026):** #1–#6 hechos en `911f227`; #2 profundizado por
> HANDOFF-T5b (cascadas por CSV, tipo de zona, gabinete territorial) en
> `d947e4b`; #7 hecho en `daf6059` (página /tablero + vistas 0015).
> Quedan abiertos #8, #9 y #10 (requieren decisiones o prueba en dispositivo).

## 1. Unificar los colores de estado

El semáforo vive duplicado: clases `derived-*` en `App.css` y el diccionario
`RESULT_COLORS` de `MapPage`. "Requiere visita presencial" es violeta en el
mapa pero no tiene color en los chips de la cola (la clase
`derived-site_visit` no existe). **Hacer**: tokens CSS únicos
(`--sem-green`, `--sem-yellow`, `--sem-orange`, `--sem-red`,
`--sem-site-visit` violeta, `--sem-none` gris) consumidos por chips, banner
derivado, mapa y leyenda.

## 2. Segmentación de ubicación (hoy solo comuna, y solo Pereira)

El formulario captura `comuna` con la lista de Pereira; los casos de Cali o
Chocó no tienen cómo registrarse bien. Propuesta de jerarquía:

```
departamento → municipio (código DIVIPOLA/DANE) → comuna o corregimiento → barrio o vereda
```

- **BD**: agregar `department` y `municipality` (código DIVIPOLA como slug
  estable) a `cases`; `commune` y `neighborhood` quedan como el nivel fino.
- **Kobo**: selects en cascada con `choice_filter` (elegir municipio filtra
  las comunas); listas por municipio afectado. XLSForm lo soporta nativo.
- **Mapa/cola**: filtro jerárquico municipio → comuna; el re-encuadre por
  municipio resuelve la navegación entre regiones.
- Decidir la fuente de la lista de comunas/corregimientos por municipio
  (DANE/alcaldías) y quién la mantiene.

## 3. Cola: filtrar lo tomado + aviso en vivo

- La pestaña Pendientes muestra también los casos tomados por otros; falta un
  filtro/orden que priorice **los no tomados** (lo accionable).
- Si alguien tiene el caso abierto y otro lo toma, el primero no se entera
  hasta intentar: falta **Supabase Realtime** (suscripción a cambios del caso
  abierto → banner "este caso lo tomó otra persona" al instante).
- Relacionado (ya anotado): liberación automática de casos tomados e
  inactivos (auto-release con pg_cron sobre `assigned_at`).

## 4. Paginación de la cola

Hoy trae todo. Con 180.000 predios potenciales: paginar con
`.range()` + `count: 'exact'` (o keyset por `priority, created_at` si el
offset duele), tamaño ~50, con los filtros aplicados server-side.

## 5. Carga de puntos en el mapa a escala

Opciones en orden de esfuerzo:
1. **Clustering client-side** (`leaflet.markercluster`) — resuelve hasta
   unos miles de puntos; ya previsto en el stack.
2. **Consulta por bbox**: cargar solo el viewport (RPC con `location &&
   ST_MakeEnvelope(...)`, índice GiST ya existe) + recargar al mover el mapa.
3. Vector tiles / agregación server-side (ST_ClusterKMeans o supercluster)
   solo si 1+2 se quedan cortos.

MVP: 1 + 2 combinados.

## 6. Ordenamiento en la cola

Permitir ordenar por prioridad (default), municipio/región y comuna
(depende de resolver el punto 2). Server-side (`.order()`), combinable con
la paginación del punto 4.

## 7. Dashboard de decisión

Vista para PMU/coordinación con datos clave: casos por estado y por
semáforo, avance por municipio/comuna (evaluados vs. total), cola pendiente
por prioridad, casos que requieren especialista, ritmo (casos/día,
dictámenes/día), revisores activos. Stack ya previsto: Recharts +
queries/vistas agregadas (sin PII). Definir con el PMU cuáles 5-6 números
deciden de verdad (pregunta 5 del marco normativo).

## 8. Gestión de formularios y de quienes los llenan

Decisiones abiertas:
- **Canal de captura**: KoboCollect con cuentas por brigadista (trazabilidad,
  QR de configuración) vs. link Enketo anónimo (fricción cero, sin autoría).
  Probablemente ambos: cuentas para brigadas organizadas, link para
  voluntarios espontáneos con moderación.
- **Gestión de usuarios de Kobo**: ¿quién crea las cuentas de brigadista?
  ¿una cuenta organizacional con enumerators? Kobo soporta usuarios con
  permisos de solo-envío por proyecto.
- **¿Embeber el formulario en la app?** Enketo se puede embeber (iframe) o
  enlazar. Enlazar es más simple y hereda el offline de Enketo; embeber da
  experiencia unificada pero suma complejidad. Propuesta: enlazar en v1.
- **Generación de links**: la URL de Enketo es estable por formulario; si se
  segmenta por municipio (punto 2) puede precargarse con parámetros
  (`d[campo]=valor`) para repartir links por zona.

## 9. Cierre del proceso de revisión

Hoy el ciclo termina en `assessed` y ahí queda. Falta definir el "después":
- **Comunicación del resultado**: el manual AIS obliga a explicar la
  clasificación al ocupante. ¿Quién y cómo? (aviso físico/acta en campo,
  notificación al contacto de la sección 12 cuando exista).
- **Visitas ordenadas**: si el dictamen marca `site_visit`/especialistas,
  ¿quién agenda, asigna y registra la visita? (conecta con el pendiente de
  revisión presencial del HANDOFF).
- **Entrega a la autoridad**: consolidación hacia PMU/alcaldía y formato del
  RUD (UNGRD) — pregunta 3 del marco normativo. Posible export CSV/GeoJSON.
- **Estados de cierre**: puede necesitarse algo después de `assessed`
  (p. ej. `communicated`, `closed`) — decidir con el flujo real del PMU.
- **Reevaluación**: ¿réplicas del sismo invalidan dictámenes? ¿un caso puede
  reabrirse? (los dictámenes nunca se borran; sería un caso nuevo o un
  segundo dictamen).

## 10. Estado del offline

- **Captura (Kobo)**: KoboCollect es offline nativo; Enketo ("En línea-Sin
  conexión") también guarda local y sincroniza. **Pendiente de probar** en
  Android real: modo avión → llenar con fotos → reconectar → verificar
  webhook (checklist de setup.md).
- **/revisar y /mapa**: requieren conexión — correcto para revisores
  remotos; no se invierte en offline ahí.
- **PWA Brigada**: el offline propio (cola local con Dexie/IndexedDB para
  check-ins y alertas) está diseñado en el stack pero **sin construir**.
