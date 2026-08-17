# Triage Estructural Post-Sismo — Plataforma de Evaluación Remota

**Contexto:** Terremoto 7,4 Mw — 10 de agosto de 2026, epicentro en San José del Palmar, Chocó (profundidad ~82 km). Afectaciones graves en Pereira, Manizales, Cali y Quibdó. Pereira concentra la mayoría de fallecidos, con decenas de edificaciones colapsadas, calamidad pública declarada y toque de queda. Escasez crítica de profesionales para diagnosticar hogares afectados.

**Objetivo del proyecto:** Multiplicar la capacidad de los pocos ingenieros estructurales disponibles mediante captura de datos en campo por personal no experto + revisión remota por especialistas + IA como pre-clasificador.

---

## 1. Cómo puede ayudar un ingeniero de sistemas tras el sismo

### Focos de mayor impacto (remoto primero, presencial después)

| Foco | Descripción |
|---|---|
| **Mapeo humanitario** | HOT / OpenStreetMap Tasking Manager: mapear daños y vías con imágenes satelitales para los rescatistas. Crítico para poblados incomunicados cerca del epicentro. |
| **Datos de desaparecidos** | Cruzar y deduplicar listas de albergues, hospitales y reportes ciudadanos (Cruz Roja, Defensa Civil). |
| **Sistemas de logística de ayuda** | Formularios + BD para inventario de donaciones, registro de damnificados, asignación de voluntarios en albergues y centros de acopio. |
| **Verificación de información** | Combatir desinformación; difundir solo fuentes oficiales (SGC, UNGRD, alcaldías). |
| **Soporte TI a entidades locales** | Sistemas caídos, backups, conectividad de emergencia en alcaldías y hospitales. |
| **Evaluación estructural digitalizada** | ⭐ El proyecto elegido — detallado abajo. |

### Reglas para el despliegue presencial
- Primeras 72 h: el trabajo técnico más valioso es **remoto**; las vías deben quedar despejadas para rescate.
- Nunca auto-desplegarse: inscribirse antes con Cruz Roja, Defensa Civil o el PMU de Risaralda.
- Ir con autonomía total (agua, comida, alojamiento) para no sumarse a la carga.
- La fase de reconstrucción (1–2 semanas después) sí requiere perfiles técnicos presenciales.

---

## 2. Software existente para diagnóstico de grietas y riesgo estructural

### Protocolos (la base metodológica)
- **ATC-20 (EE. UU.)**: protocolo estándar de evaluación rápida post-sismo. Define qué inspeccionar y el semáforo de habitabilidad:
  - 🟢 **Verde** — habitable
  - 🟡 **Amarillo** — uso restringido
  - 🔴 **Rojo** — inseguro, evacuar
- En Colombia: metodologías equivalentes de la **AIS** (Asociación Colombiana de Ingeniería Sísmica), coordinadas por alcaldías con ingenieros certificados.

### IA de detección de grietas
- **STRUCINSPECT** (comercial, Europa): detecta grietas, desconchados, refuerzo expuesto y corrosión; mide ancho de grieta automáticamente; umbrales configurables por tipo de estructura. Orientado a puentes/infraestructura.
- **CISMID-UNI (Perú)** — la referencia más cercana al contexto colombiano: cuantifica grietas en fotos de muros y las **correlaciona con niveles de daño reales** de 35 años de ensayos de laboratorio (parámetro: ratio de longitud de grietas). Enfocado en **mampostería confinada**, el sistema constructivo dominante en vivienda popular de la región. Vale la pena contactarlos.
- **Open source**: modelos YOLO (detección) y U-Net (segmentación) + dataset **SDNET2018** (~56.000 imágenes de concreto agrietado y sano) para entrenamiento/fine-tuning.

### Señales de alarma estructural (para el modelo y el formulario)
- Grietas diagonales en **X** en muros → posible falla por cortante
- Grietas **horizontales en base de columnas** → falla por flexión / rótulas plásticas
- **Refuerzo expuesto** por desprendimiento de concreto → daño severo
- Pisos desnivelados, puertas/ventanas que no cierran → deformación permanente
- Separación entre muros y columnas/vigas → pérdida de conexión estructural
- ~~Grietas > 3 mm → evacuar~~ **Corregido** (ver `docs/marco-normativo-y-negocio.md`,
  "Umbrales de grieta"): no hay umbral universal — depende del sistema
  constructivo (concreto 2,0 mm ya es "fuerte"; tapia tolera hasta 4,0 mm) y
  de la extensión. Umbrales codificados en `packages/rules` (`damageLevelThresholds`).

> ⚠️ **Principio rector:** el software hace *triage y priorización*. El dictamen de habitabilidad lo firma un ingeniero civil/estructural matriculado. Una fisura en acabados no implica daño estructural, y hay daños ocultos que una foto no revela.

---

## 3. Flujo de evaluación digitalizada (versión brigadas de expertos)

1. **PMU/alcaldía** organiza brigadas de ingenieros evaluadores por zonas.
2. Cada evaluador lleva el **formulario móvil** (KoboToolbox / Survey123) y aplica ATC-20 edificio por edificio.
3. El formulario captura: **GPS automático, fotos de cada daño, ancho/orientación de grietas, sistema constructivo, dictamen semáforo**. Funciona **offline** y sincroniza al recuperar señal.
4. Datos consolidados en **servidor central** en tiempo real.
5. *(Opcional)* **Modelo de visión** pre-procesa fotos: detecta/mide grietas y escala casos sospechosos a segunda revisión.
6. **Dashboard para el PMU**: mapa semáforo de la ciudad, avance por zona, rojos cerca de escuelas/hospitales, lista priorizada de demolición/apuntalamiento.

### Qué hace cada recurso

| Recurso | Rol |
|---|---|
| **ATC-20** | El protocolo — define criterios y clasificación. Es el "modelo de datos" del formulario. |
| **KoboToolbox** | Formularios humanitarios gratis y open source (usado por ONU/Cruz Roja). Diseño web, app offline, API REST. Desplegable en horas sin presupuesto. |
| **ArcGIS Survey123** | Equivalente comercial (ESRI), integración geoespacial nativa. Útil si la alcaldía ya tiene licencias. |
| **YOLO** | Detección de objetos ("hay una grieta aquí", bounding box). Suficiente para triage rápido. |
| **U-Net** | Segmentación píxel a píxel — traza la grieta exacta, permite medir longitud y ancho. Necesario para cuantificar daño. |
| **SDNET2018** | Dataset público (~56 k imágenes) para entrenar/fine-tunear sin partir de cero. |
| **CISMID-UNI** | Metodología de referencia: correlación grieta→nivel de daño validada en laboratorio, para mampostería confinada. |
| **STRUCINSPECT** | Referencia comercial del estado del arte en inspección con IA. |

**MVP de 1 día:** formulario ATC-20 en KoboToolbox + dashboard con mapa (API REST de Kobo + Leaflet). La capa de IA es fase 2.

---

## 4. Hardware: Raspberry Pi vs. celular

### Celular (destino final — los evaluadores ya lo llevan)
- YOLO nano/small cuantizado: 5–15 MB, varios FPS en gama media usando NPU/GPU.
- Rutas de despliegue:
  - **LiteRT** (ex TensorFlow Lite) — Android/iOS
  - **ONNX Runtime Mobile**
  - **Core ML** (solo iOS)
  - **Navegador**: TensorFlow.js / ONNX Runtime Web — sin instalar app, solo un link. Sobra para clasificar fotos.
- **Arquitectura híbrida realista:** el formulario sube la foto y la inferencia corre en el servidor. On-device solo se necesita sin conectividad (escenario real en zona de desastre → el modo offline es un plus genuino).
- Ultralytics exporta a todos estos formatos con un comando; el pipeline de entrenamiento es idéntico, solo cambia el runtime.

### Raspberry Pi + AI Camera (IMX500) + AI HAT+ 2 (Hailo)
- **Rol 1 — banco de prototipado:** validar pipeline, modelo y umbrales con YOLO en tiempo real antes de portar.
- **Rol 2 — producto propio:** **monitoreo fijo continuo** de estructuras dañadas: cámara apuntando a una grieta marcada en un edificio "amarillo", con alerta si crece o aparecen nuevas. Un celular no puede hacer esto, y las réplicas degradan estructuras ya comprometidas → necesidad real.

**Camino sugerido:** prototipar el modelo en la Raspberry (fine-tuning SDNET2018 + fotos reales del sismo) → validar detección → exportar el mismo modelo a LiteRT o al servidor.

---

## 5. Arquitectura final: triage remoto con revisión especializada

> Problema real: **pocos expertos, muchos edificios.** Precedentes: Turquía 2023, Puerto Rico 2020 (ingenieros voluntarios revisando a distancia).

### Flujo

```
[Brigadista no experto]          [Servidor]                [Ingenieros remotos]
  Formulario guiado    ──────►   IA pre-clasifica  ──────►  Cola priorizada
  + fotos obligatorias           y ordena la cola           Dictamen firmado
  + GPS (offline OK)                                        (matrícula prof.)
                                      │
                                      ▼
                            [Dashboard PMU + respuesta al habitante]
```

1. **Captura en campo** (persona entrenada en 30 min: estudiante de ing. civil, voluntario, o el habitante guiado):
   - Dirección + GPS, tipo de construcción, número de pisos.
   - Secuencia **guiada y obligatoria** de fotos: fachada completa, cada esquina, la peor grieta de cerca **con moneda como referencia de escala**, columnas del primer piso.
2. **IA como pre-clasificador:** detecta grietas, estima severidad, identifica patrones de alarma (X diagonales, horizontales en columnas, refuerzo expuesto). **No decide — ordena la cola.**
3. **Cola de revisión remota:** ingenieros estructurales voluntarios (desde cualquier ciudad/país) emiten: 🟢 / 🟡 / 🔴 / "requiere visita presencial". Cada dictamen firmado con nombre y matrícula.
4. **Salida:** resultado al habitante + mapa consolidado al PMU con rojos priorizados para visita física urgente.

### Principio de diseño no negociable
- La evaluación remota **nunca emite un verde definitivo por foto** (daños ocultos).
- El sistema sirve para dos cosas seguras:
  1. Identificar los **rojos evidentes rápido** → evacuar ya.
  2. **Priorizar** a dónde van primero los pocos expertos presenciales.
- Resultado: capacidad de cada ingeniero ×10 sin comprometer la responsabilidad legal del dictamen.

### Stack para construir rápido
| Componente | Herramienta | Esfuerzo |
|---|---|---|
| Captura en campo | KoboToolbox (formulario guiado, fotos obligatorias, offline) | Horas |
| Backend + cola de revisión | App web propia consumiendo API de Kobo: casos pendientes + registro de dictámenes | Un fin de semana (MVP) |
| IA pre-clasificadora | YOLO/U-Net fine-tuneado (SDNET2018 + fotos reales) | Fase 2 — el sistema funciona sin ella desde el día 1 |
| Revisores voluntarios | Sociedad Colombiana de Ingenieros, ACIES, universidades (UTP Pereira, Nacional, Andes) | Reclutamiento |

### Paso crítico antes de escribir código
**Presentar el proyecto a la alcaldía de Pereira / PMU o a la SCI antes de lanzar.** Dentro del sistema oficial, los dictámenes tienen validez y los datos alimentan la respuesta real. Una plataforma paralela no coordinada genera confusión y dictámenes sin respaldo.

---

## 6. Próximos pasos

- [ ] Contactar PMU Pereira / Alcaldía / Sociedad Colombiana de Ingenieros para presentar la propuesta
- [ ] Diseñar el formulario ATC-20 adaptado (campos exactos + secuencia de fotos)
- [ ] Montar formulario en KoboToolbox y probarlo offline
- [ ] MVP de la interfaz de revisión remota (cola + dictámenes firmados)
- [ ] Dashboard mapa semáforo (API Kobo + Leaflet)
- [ ] Prototipar modelo de detección de grietas en la Raspberry (AI HAT+ 2, SDNET2018)
- [ ] Reclutar ingenieros revisores voluntarios (SCI, ACIES, UTP, Nacional, Andes)
- [ ] Fase 2: integrar IA pre-clasificadora al pipeline
- [ ] Explorar contacto con CISMID-UNI (metodología grieta→daño para mampostería confinada)

---

*Documento generado el 15 de agosto de 2026, cinco días después del sismo del 10 de agosto de 2026 (7,4 Mw, Chocó, Colombia).*
