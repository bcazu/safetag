# Marco normativo, formulario oficial y contexto de negocio

> Investigación de fuentes públicas, 16 de agosto de 2026. Este documento corrige
> varios supuestos de `triage-estructural-post-sismo.md` y `stack-tecnico-mvp.md`.
> Léelo antes de seguir escribiendo código.

---

## 0. Resumen de lo que cambia

1. **El formulario no hay que diseñarlo.** Existe el *Formulario Único de Inspección
   de Edificaciones Después de un Sismo* de la AIS, con manual de campo, 17 secciones
   y una lógica de habitabilidad determinista. Es el estándar que están usando ahora
   mismo en Pereira. Digitalizarlo tal cual > adaptar ATC-20.
2. **Son cuatro colores, no tres.** Verde / Amarillo / **Naranja** / Rojo. El esquema
   de datos actual (`green|yellow|red|site_visit`) está mal.
3. **El ecosistema ya está operando** y con déficit de coordinación, no de captura.
   Ahí está el hueco real del producto.
4. **Ya existe un competidor directo** haciendo triage remoto por fotos con ingenieros
   voluntarios (SismoAyuda Colombia).
5. **La matrícula profesional no es un campo de texto.** Ley 842 de 2003 la hace
   condición de validez del dictamen; verificarla contra COPNIA es requisito.

---

## 1. Estado real de la respuesta (a 16 de agosto)

Balance UNGRD del 16 de agosto: <cite index="54-3">289 fallecidos, 4.187 heridos y 143 desaparecidos</cite>. En Pereira, el PMU reportaba <cite index="44-1">95 fallecidos, 259 heridos y 251 desaparecidos al corte de las 9:28 a.m. del 16 de agosto</cite>.

### Quién está evaluando edificaciones

| Actor | Qué está haciendo | Relevancia |
|---|---|---|
| **Asociación de Ingenieros de Risaralda** | <cite index="45-1">Coordina voluntarios desde el lunes 10 de agosto para recorrer sectores y determinar qué edificaciones representan riesgo</cite>. <cite index="45-1">Han evaluado cerca del 10 % de los 180.000 predios de la ciudad</cite> | ⭐ **El cliente.** Ya tienen los evaluadores y el mandato; les falta el sistema |
| **Escuela Colombiana de Ingeniería + Asocapitales** | Dos grupos de ingenieros voluntarios llegaron a Pereira el 15 de agosto. <cite index="54-8">La meta inicial es revisar cerca de 100 instituciones entre colegios y sedes universitarias, con seis equipos en paralelo en jornadas de seis de la mañana a siete de la noche</cite> | Priorizaron infraestructura educativa; ya coordinan con IDIGER y la Unidad de Gestión del Riesgo |
| **SCA Valle + Secretaría de Gestión del Riesgo de Cali** | <cite index="56-1">Convocatoria a arquitectos, ingenieros civiles e ingenieros estructurales para sumarse voluntariamente a la evaluación técnica de inmuebles afectados</cite> | Mismo patrón en otra ciudad → el producto es replicable |
| **Gobernación del Valle** | <cite index="48-1">Convoca voluntarios por líneas telefónicas</cite> | Coordinación por WhatsApp/teléfono = el problema que resuelves |
| **UNGRD** | <cite index="39-1">Fotografías aéreas con aeronaves tripuladas y no tripuladas en 85 municipios; sobrevuelos finalizados en 13 municipios</cite> | Capa macro. No sustituye la inspección predio a predio |
| **Alcaldía de Cali** | <cite index="51-1">Censo presencial, casa por casa, con formatos físicos</cite> | Papel en 2026. Confirma el dolor |

**Lectura:** el cuello de botella no es capturar datos — es que cada gremio, universidad
y alcaldía está corriendo su propio operativo con criterios y formatos distintos, y
nadie tiene el mapa consolidado. Tu propuesta de valor real es **el sistema de registro
compartido y la cola de priorización**, no la app de captura.

### Competencia directa

**SismoAyuda Colombia** (`sismoayudaco.com`) ya opera el mismo modelo: <cite index="41-1">un formulario ciudadano con dirección, tipo de edificio y fotos; un ingeniero civil voluntario analiza las fotos según estándares ATC-20 y EMS-98; el informe llega por email con clasificación de habitabilidad</cite>. Es una PWA, viene de una respuesta previa en Venezuela.

Su disclaimer es el modelo legal que tú también necesitas: <cite index="41-1">las evaluaciones son orientaciones técnicas preliminares basadas en análisis remoto de fotografías, no sustituyen la inspección oficial presencial, y la habilitación o inhabilitación definitiva es competencia exclusiva de la UNGRD, la Defensa Civil, Bomberos, las alcaldías y las sociedades de ingenieros</cite>.

**Decisión pendiente:** ¿competir, diferenciarse (ellos atienden al ciudadano; tú a la
brigada institucional), o contactarlos? La diferenciación defendible de SafeTag es el
lado B2G — dashboard PMU, monitor de brigadas, formulario AIS completo — no el canal
ciudadano.

---

## 2. El formulario oficial: Formulario Único AIS

**Fuente:** *Manual de Campo para la Inspección de Edificaciones Después de un Sismo*,
Asociación Colombiana de Ingeniería Sísmica (AIS), Comité AIS-400. Versión Manizales
2003 (director: Omar Darío Cardona); versión previa Bogotá/FOPAE 2002.
PDF completo: `https://idea.manizales.unal.edu.co/sitios/gestion_riesgos/descargas/manejo/manual_evaluacion.pdf`

<cite index="11-1">Se elaboró con base en la experiencia de los sismos del 8 de febrero de 1995 y el 25 de enero de 1999 en el Eje Cafetero, además de metodologías de México, Yugoslavia, Japón y Estados Unidos</cite>. Es decir: está calibrado con datos de Pereira y Armenia.

> Dato curioso y algo humillante: el manual de 2003 ya contemplaba <cite index="11-1">una aplicación de computador o sistema experto basado en redes neuronales artificiales para apoyar la evaluación por parte de profesionales no especialistas</cite>. Tu fase 2 tiene 23 años de antigüedad conceptual. Úsalo como argumento de venta, no como desánimo.

### Alcance: es nacional, no local

Existen ediciones con distinta carátula (Bogotá/FOPAE 2002, Manizales 2003) pero la
metodología es la misma y fue concebida <cite index="11-1">para consolidar una metodología básica que pueda ser aplicada a nivel nacional</cite>. Sirve igual en Pereira, Cali, Quibdó o San José del Palmar.

Lo único que cambia por territorio:

- **División administrativa.** La sección 1 dice "MANZANA **O VEREDA**": el formato ya
  contempla lo rural. Urbano = comuna/barrio; rural = corregimiento/vereda.
- **Sistemas constructivos dominantes.** En el Eje Cafetero y Cali predominan concreto y
  mampostería confinada (códigos 11–14, 21). En zona rural del Chocó predominan bahareque,
  tapia y madera (41, 42, 51, 52), que tienen umbrales de daño más laxos. El manual los
  cubre todos; el riesgo es aplicar los umbrales de concreto a una vivienda de bahareque.
- **Códigos DANE e IGAC.** Mismos esquemas nacionales.

Consecuencia de producto: **el software es uno solo.** Lo que no se replica automáticamente
es la relación institucional con cada alcaldía o gremio.

### Clasificación de cada riesgo — lo verificado y lo pendiente

**Riesgo por estabilidad global (Tabla 3-2, verificada):**

| Nivel | Criterio |
|---|---|
| Muy alto | <cite index="130-1">Colapso total o parcial superior al 50%, edificio notablemente inclinado, o entrepisos completamente desplomados que representan peligro para el ingreso, las edificaciones vecinas o la circulación</cite> |
| Alto | <cite index="130-1">Colapso parcial inferior al 50% y superior al 5%, cuya parte no colapsada no está sobrecargada ni en condiciones de colapso progresivo</cite> |
| Bajo después de medidas | <cite index="130-1">Colapso o inclinación muy puntual (inferior al 5%) que una vez apuntalados no representan peligro</cite> |
| Bajo | <cite index="130-1">No existe colapso, inclinación ni desplome de ningún entrepiso</cite> |

Regla cuantitativa de inclinación (verificada): <cite index="130-1">para edificaciones aporticadas de varios pisos, inclinación superior a 2 grados —desplazamiento horizontal mayor a 1/30 de la altura— se considera de alto riesgo; con entrepiso de 2,5 m eso equivale a más de 8 cm de desplome por piso. Se tolera más deformación en estructuras livianas de uno y dos pisos en madera o bahareque que en estructuras pesadas y no dúctiles</cite>. Además, <cite index="130-1">cualquier edificación de pórticos, particularmente las más altas, con deriva residual en uno o más pisos debe considerarse de muy alto riesgo</cite>.

**Riesgo geotécnico (Tabla 3-3, verificada):**

| Nivel | Criterio |
|---|---|
| Muy alto | <cite index="130-1">El fenómeno produjo fallas severas en la cimentación, o hay hundimiento/inclinación/asentamiento; o la edificación está sobre o muy cerca del área de influencia con potencial de reactivación inminente o muy probable</cite> |
| Alto | <cite index="130-1">Fenómeno puntual que sugiere disminución significativa de la capacidad del suelo; o edificación a distancia insuficiente para excluirla del área de influencia con reactivación inminente a muy probable</cite> |
| Bajo después de medidas | <cite index="130-1">No está en el área de influencia pero sí en sus proximidades; se recomiendan medidas preventivas porque la reactivación es probable</cite> |
| Bajo | <cite index="130-1">El fenómeno no produjo daños y tiene probabilidad menor de reactivación</cite> |

**Riesgo estructural y no estructural (Tablas 3-13 y 3-21): NO VERIFICADAS.**
El PDF público se trunca antes de esas páginas. Ver "Vacíos conocidos" abajo.

### Vacíos conocidos — pendientes de fuente primaria

La extracción del PDF (idea.manizales.unal.edu.co) se corta hacia la página 40 de 71.
Falta el contenido literal de:

| Tabla | Qué define | Impacto si falta |
|---|---|---|
| 3-8 | Niveles de daño en **bahareque** (distinto de tapia: tiene su propia tabla) | El motor de reglas no puede clasificar el sistema 51 con números reales |
| 3-9 | Niveles de daño en **acero** (vigas, columnas, conexiones) | Sistemas 31–33 sin criterios |
| 3-10 | Niveles de daño en **madera** | Sistemas 41–42 sin criterios |
| 3-11 | Niveles de daño en **entrepisos** | Falta el criterio del cuarto elemento de la matriz 5.3 |
| 3-12 | Elementos que **saturan** el daño global | Regla de agravamiento desconocida |
| 3-13 | **Severidad + extensión → nivel de riesgo estructural** | La tabla más importante para guiar al revisor: sin ella la UI no puede sugerir el riesgo estructural |
| 3-21 | Definición del riesgo **no estructural** | En el formulario impreso este riesgo parece tener solo 3 niveles (sin "Muy alto") — hay que confirmarlo con la tabla |
| 3-22 | Habitabilidad según riesgos | La lógica ya está impresa en el formulario (verificada), pero la tabla puede tener matices |

**Cómo cerrarlos:** (a) descargar el PDF completo y leer las páginas 40–70 localmente
— la URL es pública; (b) pedirle el manual físico o el PDF íntegro a la AIR/AIS en el
primer contacto (pregunta gratuita que además demuestra rigor); (c) buscar la Guía
Técnica de Bogotá 2002 o el material del IDIGER, que contienen tablas equivalentes.
**Ninguna de estas tablas debe inventarse ni estimarse**: son criterios firmados por el
Comité AIS-400 y un valor equivocado produce dictámenes equivocados.

### Otras incertidumbres declaradas

- **Vigencia de la versión.** Lo verificado es la edición Manizales 2003 (v1.0). Puede
  existir una edición posterior de la AIS o del IDIGER. Confirmar en el primer contacto
  qué versión usan las brigadas hoy — la Escuela Colombiana llevó *su propia guía* a
  Pereira, lo que sugiere que no hay un único formato en uso.
- **Ley 2474 de 2025** modificó la Ley 1523 (incluida la definición de calamidad
  pública); solo se verificó que existe la modificación, no su texto.
- **Nombres de funcionarios** (director DIGER, secretarios) provienen de noticias y
  directorios que pueden estar desactualizados: confirmar por teléfono antes de dirigir
  correos nominales.

### Las 17 secciones

| # | Sección | Contenido |
|---|---|---|
| 1 | Identificación catastral | Comuna, barrio, sector, manzana/vereda, predio, mejora o prop. horizontal, tipo avalúo |
| 2 | Tipo de inspección y clasificación | Exterior / parcial / completa; o motivo de no inspección (no se permitió, desocupada, colapso, demolida, otro) + **clasificación de habitabilidad** |
| 3 | Identificación de la edificación | Dirección (carrera/calle/transv/diag/avenida/otro + número), nombre, pisos (niveles sobre terreno / sótanos / total), uso predominante de edificación y de planta baja (11 códigos), frente y fondo en m |
| 4 | Descripción de la estructura | Sistema estructural (códigos), tipo de entrepiso (códigos), año de construcción (4 rangos) |
| 5.1 | Estabilidad global | Colapso (total / parcial ≥50% / parcial <50% / ninguno), inclinación (evidente / dudas / ninguna) + recomendaciones + **riesgo** |
| 5.2 | Problemas geotécnicos | Asentamiento, falla en talud (general/puntual/ninguno), origen, morfología del sitio (8 opciones), potencial de reactivación (4 niveles) + recomendaciones + **riesgo** |
| 5.3 | Daños estructurales | Matriz elemento × nivel de daño × % extensión, en el piso de mayor daño + medidas + **riesgo** |
| 5.4 | Daños no estructurales | 10 elementos × 5 niveles de daño + medidas + **riesgo** |
| 6 | Porcentaje global de daño | Ninguno / 0-10 / 10-30 / 30-60 / 60-100 / 100% |
| 7 | Clasificación de habitabilidad | Derivada de los 4 riesgos (ver algoritmo abajo) |
| 8 | Condiciones preexistentes | 9 variables (A–I) |
| 9 | Recomendaciones y medidas generales | Multi-selección + entidades a intervenir + visitas especializadas |
| 10 | Efecto en los ocupantes | Muertos/heridos: sí/no/no se sabe, número de heridos, número de fallecidos |
| 11 | Ocupación | ¿Habitada?, unidades existentes, unidades no habitables |
| 12 | Persona para contacto | Nombres, **cédula**, teléfono |
| 13 | Comentarios | Texto libre |
| 14 | Inspectores | Código de comisión, líder, profesión + nombre completo, **firmas** |
| 15 | Fecha de inspección | Día, mes, año, hora |
| 16 | Esquema | Dibujo |
| 17 | Fotografías | Sí/no, cuántas, rango |

### Códigos de sistema estructural (sección 4)

```
Concreto:     11 Pórtico · 12 Muros estructurales · 13 Sistemas duales · 14 Prefabricado
Mampostería:  21 Confinada · 22 Reforzada · 23 No reforzada
Acero:        31 Pórticos arriostrados · 32 Pórticos no arriostrados · 33 Pórticos en celosía
Madera:       41 Pórticos y panel en madera · 42 Pórticos madera + paneles otros materiales
Bahareque/tapia: 51 Muros en bahareque · 52 Muros en tapia
              50 Mixta · 60 Otros
```

Tipo de entrepiso: `Concreto 11 placa maciza / 12 aligerada / 13 reticular celulado ·
Acero 21 vigas alma llena con conectores / 22 sin conectores / 23 cerchas ·
Madera 31 vigas / 32 cerchas · 40 mixta · 50 otros`

Uso: `1 Residencial · 2 Comercial · 3 Educacional · 4 Salud · 5 Hotelero · 6 Oficinas ·
7 Industrial · 8 Institucional · 9 Bodegas · 10 Estacionamientos · 11 Otros`

Año: `1 Antes de 1950 · 2 1950–1982 · 3 1982–1997 · 4 A partir de 1998`
(los cortes corresponden a la entrada en vigor de los códigos sismorresistentes)

### Elementos a evaluar según sistema (sección 5.3)

| Sistema | Elementos |
|---|---|
| Pórtico en concreto reforzado | Vigas, columnas, nudos, entrepisos |
| Pórtico con muros estructurales en CR | Vigas, columnas, nudos, muros, entrepisos |
| Estructuras metálicas | Vigas, columnas, conexiones, entrepisos |
| Estructuras en madera | Vigas, columnas, conexiones, entrepisos |
| Mampostería | Muros portantes (+ columnetas y vigas de confinamiento si es confinada), entrepiso |
| Tapia, adobe, bahareque | Muros portantes, entrepiso |

La matriz de daño es: para cada elemento, marcar nivel (Ninguno / Leve / Moderado /
Fuerte / Severo) y el **porcentaje de extensión**, con umbrales distintos por nivel.
Para elementos verticales: Severo `<5% / 5-15% / >15%`, Fuerte `<10% / 10-30% / >30%`,
Moderado y Leve `<30% / 30-60% / >60%`. Para entrepisos los umbrales son más laxos
(Severo `<10% / 10-20% / >20%`). **La suma de porcentajes por elemento = 100%.**
Se evalúa **el piso de mayor daño**, indicando cuál es.

### Umbrales de grieta — el ground truth para la IA

Esto es lo que tu modelo de visión debe reproducir. Son distintos por material:

**Concreto reforzado**
| Nivel | Criterio |
|---|---|
| Ninguno / muy leve | Fisuras < 0,2 mm, casi imperceptibles |
| Leve | 0,2 – 1,0 mm, perceptible a simple vista |
| Moderado | 1,0 – 2,0 mm, pérdida incipiente del recubrimiento |
| Fuerte | Agrietamiento notable, pérdida de recubrimiento, **refuerzo longitudinal expuesto** |
| Severo | Aplastamiento del concreto, agrietamiento del núcleo, pandeo de barras, deformaciones excesivas |

**Mampostería** (el sistema dominante en vivienda popular del Eje Cafetero)
| Nivel | Criterio |
|---|---|
| Ninguno / muy leve | < 0,2 mm |
| Leve | 0,2 – 1,0 mm |
| Moderado | 1,0 – 3,0 mm, **inicio de agrietamiento diagonal en muros confinados** |
| Fuerte | Diagonal severo > 3,0 mm, dislocación de piezas |
| Severo | Desprendimiento de piezas, aplastamiento local, desplome del muro, agrietamiento diagonal que se prolonga a columnetas y vigas de confinamiento con anchos > 1,0 mm |

**Tapia pisada / adobe** (umbrales más altos: el material tolera más fisura)
| Nivel | Criterio |
|---|---|
| Ninguno / muy leve | < 0,4 mm |
| Leve | 0,4 – 2,0 mm |
| Moderado | 2,0 – 4,0 mm |
| Fuerte | > 4,0 mm + desplazamiento fuera del plano de pocos milímetros |
| Severo | Aplastamiento local, deformación, desplome apreciable |

> ⚠️ Esto invalida un supuesto del doc de diseño: **"grietas > 3 mm → evacuar" no es
> una regla universal.** El umbral depende del material y de la extensión, y "fuerte"
> no equivale a rojo. El modelo debe recibir el sistema estructural como input.

También relevante para el modelo: <cite index="11-1">es posible que existan agrietamientos previos por cargas gravitacionales, contracción del concreto, asentamientos diferenciales o intemperismo</cite> — no todo lo que detecte YOLO es daño sísmico.

### Algoritmo de habitabilidad (sección 7) — codificable tal cual

Cuatro riesgos: **estabilidad global, geotécnico, estructural, no estructural**.
Cuatro niveles cada uno: **Bajo, Bajo después de medidas, Alto, Muy alto**.

```
si (los cuatro riesgos son BAJO)                        → 🟢 Habitable
si (al menos uno es BAJO DESPUÉS DE MEDIDAS)            → 🟡 Uso restringido
si (al menos uno es ALTO)                               → 🟠 No habitable
si (al menos uno es MUY ALTO  o  más de dos son ALTO)   → 🔴 Peligro de colapso
```

Se evalúa en cascada: la primera condición que se cumpla de abajo hacia arriba manda.

**El naranja es la categoría que te falta.** Semánticamente: <cite index="42-1">naranja significa que hay daño estructural y la capacidad de carga se redujo; no se ocupa hasta la evaluación detallada. Rojo son daños generalizados con riesgo inminente de colapso: evacuación completa e inmediata, incluido el entorno. Y rojo no significa demoler</cite>.

### Reglas de procedimiento que el software debe hacer cumplir

- <cite index="11-1">Los evaluadores se organizan en comisiones de dos personas, lideradas por un ingeniero estructural o el profesional de más amplia experiencia, quien toma la decisión final sobre la clasificación</cite> → el dictamen tiene **un** responsable, no un colectivo.
- <cite index="11-1">Personas sin experiencia en diseño de edificaciones o patología de estructuras no pueden recomendar la demolición; deben solicitar visita de un experto y señalar la inminencia del peligro</cite> → **regla de negocio dura**: si el revisor no tiene el perfil, la opción "posible demolición" se bloquea.
- <cite index="11-1">Todas las edificaciones clasificadas como indispensables o de atención a la comunidad deben ser evaluadas por ingenieros estructurales</cite> → si `uso ∈ {salud, educacional, institucional}`, enrutar a revisor con perfil estructural. Esto conecta directo con la prioridad actual del operativo de la Escuela.
- <cite index="11-1">Para edificaciones con problemas de suelos el equipo debe incluir un ingeniero especialista en geotecnia</cite> → segunda regla de enrutamiento.
- <cite index="11-1">Se debe explicar verbalmente el significado de la clasificación a los ocupantes</cite> → hay una obligación de comunicación al habitante que hoy no está en el MVP.
- El perfil esperado del evaluador es <cite index="11-1">ingeniero civil, arquitecto o técnico en obras civiles, preferiblemente con cinco años de experiencia mínimo en diseño estructural o construcción</cite>; <cite index="11-1">se pueden usar estudiantes de últimos semestres en zonas de menor afectación o como auxiliares</cite>.

> El último punto **contradice parcialmente** la premisa del doc de diseño ("brigadista
> no experto entrenado en 30 minutos"). La metodología oficial no contempla captura por
> legos. Tu argumento tiene que ser: el brigadista no evalúa, **documenta**; la
> evaluación la hace el profesional remoto. Prepárate a defenderlo, porque es la primera
> objeción que te van a poner en la SCI.

---

## 3. Marco legal

### 3.1 Gestión del riesgo — Ley 1523 de 2012

Régimen general. **Ojo: fue modificada por la Ley 2474 de 2025**, incluida la definición
de calamidad pública (art. 4 numeral 5). Verificar el texto vigente en Secretaría del
Senado antes de citarla en una propuesta.

Puntos que importan:

- <cite index="17-1">Los artículos 12, 13 y 14 establecen que alcaldes y gobernadores son los encargados de la gestión del riesgo en su nivel territorial y responsables del control de las emergencias en su territorio</cite>. **El dueño del dato es la alcaldía, no tú.**
- <cite index="17-1">Una vez hecha la declaratoria de calamidad pública, alcaldías y gobernaciones deben solicitar usuario y contraseña a la UNGRD para usar el RUD</cite> (Registro Único de Damnificados). → Existe un sistema nacional al que probablemente haya que exportar. Pregunta obligada al PMU: *¿qué formato consume el RUD?*
- La **EDAN** (Evaluación de Daños y Análisis de Necesidades) es una de las funciones de respuesta formalmente definidas. Tu plataforma es una herramienta de EDAN sectorial (edificaciones), no algo nuevo.
- <cite index="14-1">El régimen especial para situaciones de desastre y calamidad pública está en el Capítulo VII</cite> — relevante porque habilita contratación directa. Si la alcaldía quiere pagarte, ese es el camino.

Bajo declaratoria de desastre, <cite index="67-1">los alcaldes pueden ordenar la demolición de toda edificación que amenace ruina o que por su estado de deterioro ponga en peligro la seguridad o salubridad</cite>. Confirma la frontera: **tu sistema recomienda, el alcalde ordena.**

### 3.2 Ejercicio profesional — Ley 842 de 2003

Esta es la que define si tus dictámenes valen algo.

- <cite index="23-1">Todo trabajo relacionado con el ejercicio de la ingeniería debe ser dirigido por un ingeniero inscrito en el registro profesional y con tarjeta de matrícula profesional en la rama respectiva</cite>.
- <cite index="23-1">Cuando la obra sea de las que trata la Ley 400 de 1997 se deben cumplir además los requisitos de ese régimen, so pena de las sanciones por violación del Código de Ética</cite>. La Ley 400 de 1997 es la ley marco de construcciones sismorresistentes, reglamentada por la NSR-10.
- <cite index="23-1">Artículo 19 — dictámenes periciales: el cargo de perito, cuando el dictamen comprenda cuestiones técnicas de ingeniería, se encomienda al profesional cuya especialidad corresponda a la materia objeto del dictamen</cite>. → El enrutamiento por especialidad no es una feature bonita: es cumplimiento normativo.
- El ejercicio ilegal de la ingeniería es sancionable y <cite index="21-1">el COPNIA debe dar aviso a las empresas de las denuncias por ejercicio ilegal, para proteger a la sociedad del riesgo</cite>.

**Implicaciones de producto:**
- `reviewers.professional_license` debe validarse contra el registro público del COPNIA
  (consulta de vigencia de matrícula). Hoy `verified bool` no dice contra qué.
- Guardar la **rama** de la matrícula, no solo el número.
- El dictamen firmado debe ser inmutable y auditable: nombre, matrícula, rama, timestamp,
  y las fotos/datos exactos sobre los que se pronunció. Si un dictamen remoto termina en
  un proceso disciplinario, el ingeniero necesita poder demostrar qué vio.
- Un ingeniero cuya matrícula esté suspendida no debe poder emitir. Verificación
  periódica, no solo al registrarse.
- Extranjeros: la ley contempla permiso temporal para titulados domiciliados en el
  exterior. Si vas a reclutar revisores fuera de Colombia, hay trámite.

### 3.3 Datos personales — Ley 1581 de 2012

Estás recolectando: dirección exacta, GPS, fotos del interior de viviendas, **cédula y
teléfono del contacto** (sección 12), **número de heridos y fallecidos** (sección 10),
y ubicación en vivo de brigadistas.

- Número de heridos y fallecidos por vivienda es **dato sensible** (salud). <cite index="31-1">Cuando se traten datos sensibles hay que informar al titular que no está obligado a autorizar su tratamiento, indicar cuáles son sensibles y su finalidad, y obtener consentimiento expreso</cite>.
- Necesitas **política de tratamiento + aviso de privacidad + registro de autorizaciones**. La diferencia práctica: <cite index="34-1">tener una política publicada y poder demostrar cada autorización con su fecha son cosas muy distintas cuando la autoridad verifica</cite>.
- **RNBD** (Registro Nacional de Bases de Datos) ante la SIC — verificar si aplica según el tamaño/naturaleza del responsable; el régimen ha cambiado varias veces.
- <cite index="31-1">La transmisión a un Encargado fuera de Colombia tiene requisitos propios</cite> → Supabase en São Paulo y Vercel implican transferencia internacional. Documentarlo.
- **Geolocalización de brigadistas**: el doc ya tiene la decisión correcta (solo durante misión activa, TTL 24 h). Formalízalo como política escrita y consentimiento explícito al activar "en misión".

**Salida más limpia:** si la alcaldía o el gremio es el **Responsable del Tratamiento** y
tú el **Encargado**, la carga jurídica se reparte correctamente y refuerza el argumento
de operar dentro del sistema oficial. Eso exige un contrato de encargo. Vale la pena
tenerlo redactado antes de la reunión.

### 3.4 Norma técnica

- **Ley 400 de 1997** — marco de construcciones sismorresistentes.
- **NSR-10** — Reglamento Colombiano de Construcción Sismo Resistente. <cite index="62-1">La versión actual corresponde a su sexta actualización</cite>, y la AIS tiene propuestas de actualización en curso junto con una nueva versión del documento AIS-100. Conviene verificar qué está vigente hoy.
- **AIS** es <cite index="62-1">la entidad encargada de la interpretación y aplicación de las normas sobre construcciones sismo resistentes</cite>. Es decir: es el interlocutor técnico que da o quita legitimidad a tu formulario. Prioridad de contacto alta.

---

## 4. Cambios concretos al proyecto

### Esquema de datos

```sql
-- assessments.result: cuatro estados, no tres
result text CHECK (result IN ('green','yellow','orange','red','site_visit'))

-- Los cuatro riesgos, que son lo que PRODUCE el color
risk_global_stability   text CHECK (... IN ('low','low_after_measures','high','very_high'))
risk_geotechnical       text CHECK (...)
risk_structural         text CHECK (...)
risk_nonstructural      text CHECK (...)
-- result se puede derivar, pero guárdalo explícito: el revisor puede justificar
-- una desviación y eso hay que poder auditarlo.

-- cases: campos AIS que faltan
inspection_type      text        -- exterior | partial | complete | not_inspected
not_inspected_reason text        -- no_permitido | desocupada | colapso | demolida | otro
cadastral_id         text        -- sector-manzana-predio-mejora (IGAC)
structural_system    text        -- código AIS: '11','21','52'...
floor_system         text
building_use         int         -- 1..11
ground_floor_use     int
year_range           int         -- 1..4
floors_above         int
basements            int
front_m              numeric
depth_m              numeric
worst_damaged_floor  int
global_damage_pct    text        -- rango, no número
preexisting          jsonb       -- condiciones A..I sección 8
occupancy            jsonb       -- secciones 10 y 11
contact              jsonb       -- ⚠️ dato personal: cifrar / acceso restringido por RLS

structural_damage    jsonb       -- matriz elemento × nivel × %extensión
nonstructural_damage jsonb       -- 10 elementos × 5 niveles

-- reviewers
professional_license text
license_branch       text        -- rama de la matrícula (Ley 842 art. 19)
license_verified_at  timestamptz
specialty            text        -- structural | geotechnical | general
can_recommend_demolition bool default false
```

### Reglas de negocio a implementar

- [ ] Derivar habitabilidad con el algoritmo de la sección 7; mostrar la sugerencia al
      revisor y exigir justificación escrita si se desvía.
- [ ] Bloquear "posible demolición" salvo `can_recommend_demolition = true`.
- [ ] Enrutar automáticamente a revisor estructural si `building_use ∈ {3,4,8}`
      (educacional, salud, institucional).
- [ ] Enrutar a geotecnista si la sección 5.2 marca asentamiento o falla en talud.
- [ ] Umbrales de grieta parametrizados **por sistema estructural**, no globales.
- [ ] Consentimiento informado en el formulario Kobo, con mención expresa de datos
      sensibles (sección 10) y opción de no responder.
- [ ] Dictamen inmutable: snapshot de los datos y fotos evaluados, no referencia mutable.

### Documentos a producir antes de la reunión

- [ ] Una hoja: "SafeTag para la Asociación de Ingenieros de Risaralda" — qué resuelve
      hoy, en el operativo que ya tienen corriendo.
- [ ] Política de tratamiento de datos + aviso de privacidad + modelo de contrato de encargo.
- [ ] Nota técnica de trazabilidad del dictamen (para tranquilizar al gremio sobre
      responsabilidad profesional). Esta es la objeción #1.

---

## 5. Riesgos del modelo

| Riesgo | Realidad | Mitigación |
|---|---|---|
| El dictamen remoto no tiene valor oficial | Confirmado: la habilitación definitiva es competencia de las autoridades | Posicionarse como **priorización + registro**, nunca como dictamen final. Verde definitivo por foto: nunca |
| La metodología AIS no contempla evaluadores legos | Confirmado | Reformular: el brigadista **documenta**, no evalúa |
| Un revisor voluntario expone su matrícula | Riesgo disciplinario real bajo Ley 842 | Trazabilidad total + límites explícitos del alcance del concepto emitido |
| Llegar tarde | El operativo lleva 6 días corriendo y SismoAyuda ya está en línea | Contactar **esta semana**. El valor cae cada día |
| Duplicar esfuerzo | Varias plataformas compitiendo por los mismos voluntarios | Explorar alianza en vez de competencia |

---

## 6. Preguntas que solo se resuelven llamando

Para el PMU / Asociación de Ingenieros de Risaralda / AIS:

1. ¿Qué formulario están usando hoy — el Formulario Único AIS, la guía de la Escuela
   Colombiana, o algo propio? ¿En papel o digital?
2. ¿Dónde se consolida? ¿Existe ya una base de datos, o son PDFs y WhatsApp?
3. ¿Qué necesita el RUD de la UNGRD como formato de entrada?
4. ¿Quién valida hoy las matrículas de los voluntarios?
5. ¿Cuántos evaluadores activos hay y cuál es el cuello real: gente, coordinación o consolidación?
6. ¿Aceptarían un concepto remoto como insumo de priorización, o solo presencial?

**La pregunta 5 decide el producto.** Si el cuello es coordinación y consolidación —que es
lo que sugiere todo lo anterior— el dashboard y la cola valen más que la IA, y la fase 2
puede esperar indefinidamente.

---

## 7. Interlocutores por territorio

### Pereira
- **AIR – Asociación de Ingenieros de Risaralda** — Calle 17 N° 6-42 Of. 302, Ed. Club
  Rialto. WhatsApp 311 631 2210 · presidencia@air.org.co · director@air.org.co.
  Coordinan voluntarios desde el 10 de agosto; ~10 % de 180.000 predios evaluados.
- **DIGER Pereira** — diger@pereira.gov.co · 324 8110 · conmutador (606) 324 8000.
  Cl. 19 #10-02. Autoridad municipal bajo Ley 1523.
- **Escuela Colombiana de Ingeniería + Asocapitales** — seis equipos en terreno,
  prioridad infraestructura educativa. Enlace logístico: José Ignacio Nieto García.

### Cali
- **Secretaría de Gestión del Riesgo de Emergencias y Desastres** — Hotel Aristi,
  Calle 11 #9-20 piso 9. Secretario: Ricardo Peñuela.
- **Punto de voluntarios técnicos**: <cite index="53-1">Cruz Roja Seccional Valle del Cauca, Cra. 38 Bis #5-91, con personal de la Secretaría presente todo el día</cite>.
- **SCA regional Valle** — co-organiza la convocatoria de evaluadores.
- **Gobernación del Valle** — secretario Francisco Javier Tenorio Lara.
  Líneas: 315 584 6176 · 322 542 5084 · 315 529 9442.
- Señal de oportunidad: <cite index="51-1">el censo se está haciendo presencial, casa por casa y con formatos físicos</cite>.

### Chocó
Contexto operativo distinto. <cite index="117-1">San José del Palmar sigue sin luz ni agua potable, con la única carretera bloqueada por deslizamientos y acceso solo por helicóptero; la falta de señal impide cerrar los reportes de daños en las veredas</cite>. <cite index="113-1">La UNGRD entregó equipos Starlink; el fondo municipal de gestión del riesgo era de poco más de 32 millones de pesos, y el municipio no tiene conexión terrestre directa con Quibdó — se accede desde Cartago</cite>.

- **Gobernación del Chocó** — choco.gov.co, Consejo Departamental de Gestión del Riesgo.
  Gobernadora: Nubia Carolina Córdoba-Curi.
- **Alcaldía de Quibdó** — Cra. 2 #24A-32.
- **UTCH – Universidad Tecnológica del Chocó** — fuente local de brigadistas capacitables.
- **UNGRD** — contactenos@gestiondelriesgo.gov.co · 01-8000-113200. Para Chocó la vía
  nacional es más viable que la municipal: no hay cuerpo gremial local que coordinar.

### Nacionales
- **AIS** (asosismica.org.co) — autores del formulario, dan legitimidad técnica.
- **SCI** — Cra. 4 #10-41 Bogotá · prensasci@sci.org.co · socios@sci.org.co.
  Presidente Hernando Monroy Benítez (vigente a feb. 2026).

---

## Fuentes principales

- Manual de Campo AIS: `https://idea.manizales.unal.edu.co/sitios/gestion_riesgos/descargas/manejo/manual_evaluacion.pdf`
- Ley 1523 de 2012 (texto con modificaciones): `http://www.secretariasenado.gov.co/senado/basedoc/ley_1523_2012.html`
- Ley 842 de 2003 (COPNIA): `https://www.copnia.gov.co/nuestra-entidad/normatividad/ley-842-de-2003`
- Ley 1581 de 2012 / SIC preguntas frecuentes: `https://sic.gov.co/preguntas-frecuentes-pdp`
- AIS: `https://asosismica.org.co/`
- SismoAyuda Colombia: `https://sismoayudaco.com/`
