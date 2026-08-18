# Tablas del manual AIS antes marcadas como vacíos — VERIFICADAS

> Fuente primaria: *Manual de Campo para la Inspección de Edificaciones Después
> de un Sismo*, AIS / Alcaldía de Manizales, **versión 1.0, junio de 2003**
> (83 páginas). Descargado completo el 17-ago-2026 desde
> `https://idea.manizales.unal.edu.co/sitios/gestion_riesgos/descargas/manejo/manual_evaluacion.pdf`
> y guardado en `docs/referencias/manual-ais-manizales-2003.pdf`.
>
> Este documento cierra los "Vacíos conocidos" del HANDOFF (tablas 3-8 a 3-13,
> 3-21 y 3-22). Los `TODO(tabla 3-X)` del código pueden resolverse contra esto.

## Tabla 3-8 — Niveles de daño en bahareque (y tapia) [p. 42]

Distingue **bahareque no-encementado** y **encementado**. Criterios cualitativos
(no hay anchos de grieta en mm):

| Nivel | No-encementado | Encementado |
|---|---|---|
| Ninguno / muy leve | Sin agrietamiento en los revoques | Sin agrietamiento en los revoques |
| Leve | Agrietamiento incipiente de revoques de muros con mortero de barro; uniones completamente sanas | Agrietamiento incipiente de revoques en esquinas de puertas y ventanas; uniones sanas |
| Moderado | Agrietamiento vertical de esquinas de muros; grietas diagonales y horizontales generalizadas; desprendimiento parcial de revoques y de clavos/elementos de fijación | Grietas diagonales en algunos muros; desprendimiento incipiente de clavos y elementos de unión |
| Fuerte | Deslizamiento relativo en empalmes de muros; agrietamiento en prácticamente todos los muros; pérdida de apoyo parcial de cubierta y/o entrepisos | Grietas diagonales en la mayoría de muros; pérdidas considerables de revoque; pérdida de apoyo parcial de cubierta y/o entrepisos |
| Severo | Deformaciones permanentes importantes (posibilidad de desplome); falla de diagonales; desprendimiento de pies derechos de las soleras; pandeo perpendicular al plano del muro; falla parcial o total de cimentación; pérdida generalizada de apoyos de cubierta | (mismos criterios) |

## Tabla 3-9 — Niveles de daño en acero (vigas, columnas y conexiones) [p. 46]

| Nivel | Criterio |
|---|---|
| Ninguno / muy leve | Sin defectos visibles |
| Leve | Deformaciones menores casi imperceptibles |
| Moderado | Deformaciones perceptibles a simple vista; pandeo incipiente de secciones |
| Fuerte | Pandeo local, fractura o evidencia de daño **fuera** de zonas de posible formación de articulaciones plásticas |
| Severo | Pandeo local, fractura o daño **dentro** de zonas de articulación plástica; fractura de soldaduras, tornillos o remaches |

## Tabla 3-10 — Niveles de daño en madera [p. 47]

| Nivel | Criterio |
|---|---|
| Ninguno / muy leve | Sin agrietamiento en el elemento |
| Leve | Fisuración mínima |
| Moderado | Agrietamiento en el elemento; desplazamiento insignificante en uniones |
| Fuerte | Agrietamiento notable; deslizamiento o desplazamiento claramente perceptible en uniones |
| Severo | Disminución de la sección transversal o rompimiento del elemento; separación o desprendimiento del sistema estructural |

## Tabla 3-11 — Niveles de daño en entrepisos [p. 48]

Mismos anchos que concreto (superficie):

| Nivel | Criterio |
|---|---|
| Ninguno / muy leve | Fisuras < 0,2 mm, casi imperceptibles |
| Leve | 0,2 – 1,0 mm, perceptible a simple vista |
| Moderado | 1,0 – 2,0 mm, pérdida incipiente del recubrimiento |
| Fuerte | Agrietamiento apreciable, pérdida del recubrimiento |
| Severo | Degradación y aplastamiento del material, agrietamiento severo |

## Tabla 3-12 — Elementos que saturan el daño global [p. 49]

Daño **severo** en estos elementos puede comprometer toda la edificación
(saturación del daño global → posible evacuación inmediata):

| Sistema | Elementos de saturación |
|---|---|
| Pórtico en concreto reforzado | Nudos o columnas |
| Pórtico con muros estructurales en CR | Muros, nudos o columnas |
| Estructuras de acero | Conexiones, columnas o riostras |
| Estructuras de madera | Conexiones o columnas |
| Mampostería no confinada | Muros de carga |
| Mampostería reforzada | Muros |
| Mampostería confinada | Muros (con columnetas y vigas de confinamiento) |
| Tapia, adobe o bahareque | Muros de soporte |

## Tabla 3-13 — Severidad + extensión → riesgo estructural [p. 50]

La tabla que faltaba para el helper de sugerencia en `/revisar`:

| Riesgo | Criterio |
|---|---|
| **Muy alto** | Daño **severo** en > 15 % de elementos verticales (columnas en pórticos; muros en sistemas de muros), o severo en > 20 % de vigas o entrepisos; o daños **fuertes** en > 30 % **y moderados** en > 60 % de los verticales; o fuertes en > 40 % de los horizontales; o entrepisos cercanos al desplome / deformaciones permanentes en columnas o muros |
| **Alto** | Severo entre 5 y 15 %, fuerte entre 10 y 30 % o moderado entre 30 y 60 % de los verticales. Riesgo asociado a entrar/usar el edificio; acceso controlado, no usable antes de reforzar; evaluar apuntalamiento |
| **Bajo después de medidas** | Peligro puntual: severo < 5 %, fuerte < 10 %, moderado < 30 %; no reduce la capacidad global; ocupación restringida por sectores condicionada a reparación o apuntalamiento |
| **Bajo** | Daños leves muy puntuales (< 30 % de los elementos) o sin daños |

## Tabla 3-21 — Riesgo no estructural [p. 59]

**Confirmado: solo tres niveles** (bajo, bajo después de medidas, alto). No
existe "muy alto" para este riesgo.

| Riesgo | Criterio |
|---|---|
| Alto | Daños severos o fuertes generalizados y dispersos por toda la edificación; elementos de fachada, balcones, antepechos, cielos rasos, tanques elevados u otros en peligro de caer; derrame de tóxicos, líneas de gas rotas o líneas de energía caídas |
| Bajo después de medidas | Daños concentrados en un área pequeña, aislable con barreras; o los elementos en peligro se pueden remover o anclar fácilmente |
| Bajo | Daños leves y muy puntuales sin peligro para las personas, o sin daños |

## Tabla 3-22 — Habitabilidad [p. 60] ⚠️ discrepancia interna del manual

Texto de la tabla: *«Peligro de colapso: si fueron asignadas una o más
calificaciones de RIESGO MUY ALTO **o dos o más** de calificación de RIESGO
ALTO»*. Pero el margen del formulario impreso (misma página) dice *«…o **más
de dos** de RIESGO ALTO»*.

- `packages/rules/src/habitability.ts` hoy implementa la versión del margen
  (`highs > 2`, es decir rojo con 3+).
- La tabla 3-22 (que el texto señala como criterio: «de acuerdo con los
  criterios establecidos en la Tabla 3-22») exige solo **2** ALTO para rojo —
  lectura más conservadora/protectora.
- **Decisión pendiente del producto**: confirmar con AIS/AIR qué lectura usan
  las brigadas; mientras tanto documentar la ambigüedad en cualquier dictamen
  fronterizo (exactamente 2 riesgos ALTO).

## Sección 5.2 del formulario (problemas geotécnicos) — campos oficiales [p. 28-32]

- **Asentamiento de la edificación**: Evidente / Existen dudas / Ninguno
- **Falla en talud o movimiento en masa**: General / Puntual / Ninguno
- **Morfología del sitio**: 1 Divisoria · 2 Cresta · 3 Ladera · 4 Pie de ladera
  · 5 Valle · 6 Canal · 7 Borde de río · 8 Talud
- **Origen**: 1 Producido por el sismo · 2 Agravado por el sismo ·
  3 Pre-existente · 4 Existen dudas
- **Potencial de reactivación**: 1 Menor · 2 Probable · 3 Muy probable · 4 Inminente

(En SafeTag el brigadista captura asentamiento, falla en talud y morfología —
observables; origen y potencial son juicio del profesional.)

## Otras precisiones del manual útiles al producto

- Uso 10 se llama **"Parqueaderos"** en la tabla 3-1 (el repo usa
  "Estacionamientos"; mismo código).
- Número de pisos (3.4.3): niveles sobre el terreno = placas aéreas + primer
  piso, **sin contar cubierta ni terraza**; en ladera se evalúa desde la
  entrada principal.
- Porcentaje global de daño (3.11): área afectada / área total, considerando
  daños estructurales y no estructurales, **sin** contenidos; se usa para
  estimar pérdidas económicas.
- Recomendaciones (3.9.8): barreras externas, no entrar, estudio de
  vulnerabilidad, posible demolición; sin experiencia en diseño/patología no
  se puede recomendar demolición (ya codificado).
