"""Genera kobo/ais.xlsx — Formulario Único AIS (v1) para KoboToolbox.

Digitaliza el *Formulario Único de Inspección de Edificaciones Después de un
Sismo* (AIS, Comité AIS-400). Ver docs/marco-normativo-y-negocio.md §2.
V1 = secciones imprescindibles: 1 (catastral), 2 (tipo inspección),
3 (identificación), 4 (estructura), 5.1 (estabilidad global), 5.3 (daños
estructurales), 6 (% global), 17 (fotos). Segunda pasada: 5.2, 5.4, 8-13.

El brigadista DOCUMENTA, no evalúa: el formulario captura observaciones; los
riesgos y la habitabilidad los asigna el revisor profesional (packages/rules).

Uso:
    pip install openpyxl pyxform   # en un venv
    python kobo/gen_xlsform.py
    xls2xform kobo/ais.xlsx /tmp/ais.xml   # validar

Listas territoriales: kobo/media/*.csv (select_one_from_file). Se suben a
Kobo como media files del formulario (Settings → Media); corregirlas no
exige redesplegar. Ver kobo/media/README.md (fuentes y TODOs).

Multiidioma: columnas `label::Idioma (cod)`. Para sumar un idioma, añadirlo a
LANGS y completar los diccionarios {"es": ...}. Los `name` de los campos son
el contrato con supabase/functions/kobo-webhook: no renombrar a la ligera.
"""
from pathlib import Path

from openpyxl import Workbook

LANGS = {"es": "Español (es)"}
DEFAULT_LANG = "Español (es)"

I18N_COLS = ["label", "hint", "constraint_message"]
PLAIN_COLS = ["type", "name", "required", "appearance", "relevant",
              "constraint", "parameters", "choice_filter", "default"]

# Default de municipio por despliegue (código DIVIPOLA) — parámetro, no
# hardcode: el form desplegado para la brigada de Pereira puede llevar "66001".
MUNICIPIO_DEFAULT = ""

# Relevancia común: todo salvo secciones 1-2 se oculta si no se inspeccionó
INSPECTED = "${tipo_inspeccion} != 'no_inspeccionada'"

# Conjuntos de sistema estructural para la matriz de daño (sección 5.3)
PORTICOS = ["11", "12", "13", "14", "31", "32", "33", "41", "42"]
NUDOS = ["11", "12", "13", "14"]
CONEXIONES = ["31", "32", "33", "41", "42"]
MUROS_CR = ["12", "13"]
MUROS_PORTANTES = ["21", "22", "23", "51", "52", "50", "60"]
CONFINADA = ["21"]


def sys_in(codes):
    ors = " or ".join(f"${{sistema_estructural}} = '{c}'" for c in codes)
    return f"({ors})"


def damage_pair(name, label_es, codes):
    """select_one nivel + % de extensión para un elemento de la matriz 5.3."""
    rel = f"{INSPECTED} and {sys_in(codes)}"
    return [
        {"type": "select_one niveles_dano", "name": f"dano_{name}",
         "label": {"es": f"Daño en {label_es}"}, "required": "yes",
         "relevant": rel},
        {"type": "integer", "name": f"dano_{name}_pct",
         "label": {"es": f"% de extensión del daño en {label_es}"},
         "required": "yes",
         "relevant": f"{rel} and ${{dano_{name}}} != 'ninguno'",
         "constraint": ". >= 1 and . <= 100",
         "constraint_message": {"es": "Debe estar entre 1 y 100"}},
    ]


survey = [
    # metadatos
    {"type": "start", "name": "start"},
    {"type": "end", "name": "end"},
    {"type": "start-geopoint", "name": "gps_fondo"},

    # aviso de privacidad + confirmación (T6; política completa en
    # docs/politica-datos.md). Cuando se agreguen las secciones 10-12
    # (ocupantes/contacto), añadir aquí el consentimiento expreso para datos
    # sensibles, con mención de que el titular NO está obligado a autorizarlo.
    {"type": "note", "name": "aviso_privacidad",
     "label": {"es": "AVISO DE PRIVACIDAD — Esta inspección registra "
                     "ubicación, características y fotografías de la "
                     "edificación (solo exteriores y elementos "
                     "estructurales, no personas ni interiores habitados "
                     "salvo lo estrictamente necesario) para priorizar la "
                     "evaluación estructural post-sismo. Tratamiento según "
                     "la Ley 1581 de 2012; política completa disponible con "
                     "la entidad coordinadora. La clasificación resultante "
                     "es un insumo de priorización: la habilitación "
                     "definitiva es competencia de las autoridades."}},
    {"type": "select_one confirmaciones", "name": "aviso_comunicado",
     "label": {"es": "¿Informaste al ocupante o responsable del inmueble el "
                     "propósito de la inspección y el aviso de privacidad?"},
     "required": "yes",
     "hint": {"es": "Si no hay nadie presente, marca «No aplica (inmueble "
                    "desocupado o sin acceso)»"}},

    # ── Sección 2: tipo de inspección ────────────────────────────────────
    {"type": "select_one tipos_inspeccion", "name": "tipo_inspeccion",
     "label": {"es": "Tipo de inspección"}, "required": "yes"},
    {"type": "select_one motivos_no_inspeccion", "name": "motivo_no_inspeccion",
     "label": {"es": "¿Por qué no se inspeccionó?"}, "required": "yes",
     "relevant": "${tipo_inspeccion} = 'no_inspeccionada'"},

    # ── Secciones 1 y 3: ubicación e identificación (HANDOFF-T5b) ────────
    # El GPS es la fuente de verdad; los nombres son metadatos legibles
    # (reasignación por ST_Contains en gabinete). Listas territoriales como
    # CSV adjuntos (kobo/media/*.csv), NUNCA en la hoja choices: corregir
    # una lista no puede exigir redesplegar el formulario. Los `name` de
    # municipios.csv SON los códigos DIVIPOLA (contrato con la BD).
    {"type": "select_one_from_file municipios.csv", "name": "municipio",
     "label": {"es": "Municipio"}, "required": "yes", "appearance": "minimal",
     "default": MUNICIPIO_DEFAULT},
    {"type": "select_one tipo_zona", "name": "tipo_zona",
     "label": {"es": "Tipo de zona"}, "required": "yes"},
    # Urbano y rural comparten estructura (misma columna en BD): dos
    # preguntas con relevant excluyente en vez de label dinámico — más
    # simple en XLSForm. Comuna ↔ corregimiento.
    {"type": "select_one_from_file divisiones.csv", "name": "division_urbana",
     "label": {"es": "Comuna"}, "required": "yes", "appearance": "minimal",
     "relevant": "${tipo_zona} = 'urbano'",
     "choice_filter": "municipio_code=${municipio} and tipo='urbano'"},
    {"type": "select_one_from_file divisiones.csv", "name": "division_rural",
     "label": {"es": "Corregimiento"}, "required": "yes",
     "appearance": "minimal",
     "relevant": "${tipo_zona} = 'rural'",
     "choice_filter": "municipio_code=${municipio} and tipo='rural'"},
    # La fila OTRO de barrios.csv es global: el choice_filter la incluye
    # siempre para que ninguna lista incompleta bloquee una evaluación.
    {"type": "select_one_from_file barrios.csv", "name": "barrio",
     "label": {"es": "Barrio / Vereda"}, "required": "yes",
     "appearance": "minimal",
     "choice_filter": "division_code=if(${tipo_zona} = 'urbano', "
                      "${division_urbana}, ${division_rural}) "
                      "or name='OTRO'"},
    {"type": "text", "name": "barrio_otro", "label": {"es": "¿Cuál?"},
     "required": "yes", "relevant": "${barrio} = 'OTRO'"},
    {"type": "select_one via_tipo", "name": "via_tipo",
     "label": {"es": "Tipo de vía"},
     "relevant": "${tipo_zona} = 'urbano'"},
    {"type": "text", "name": "via_numero", "label": {"es": "Número de vía"},
     "relevant": "${tipo_zona} = 'urbano'"},
    {"type": "text", "name": "numero_placa", "label": {"es": "Número (placa)"},
     "relevant": "${tipo_zona} = 'urbano'"},
    {"type": "text", "name": "referencia_ubicacion",
     "label": {"es": "Referencia de ubicación"},
     "hint": {"es": "Finca, kilómetro, punto de referencia"}},
    {"type": "text", "name": "nombre_edificacion",
     "label": {"es": "Nombre de la edificación (si tiene)"},
     "hint": {"es": "Propiedad horizontal o institución"}},
    # Sin constraint que impida guardar por ubicación: el GPS puede fallar
    # bajo techo; el webhook acepta el start-geopoint de respaldo como
    # último recurso. Nunca perder una evaluación por GPS.
    {"type": "geopoint", "name": "ubicacion", "label": {"es": "Ubicación GPS"},
     "required": "yes",
     "hint": {"es": "Capturar de pie frente a la edificación, con cielo "
                    "visible. Si no captura bajo techo, reintentar afuera."}},
    # La identificación catastral (IGAC) NO se le exige al brigadista: el
    # manual AIS asigna el número predial en oficina cruzando con catastro.
    {"type": "begin_group", "name": "catastral",
     "label": {"es": "Identificación catastral (opcional)"},
     "appearance": "field-list",
     "hint": {"es": "Solo si tiene el recibo de predial a la vista"}},
    {"type": "text", "name": "cat_sector", "label": {"es": "Sector"}},
    {"type": "text", "name": "cat_manzana", "label": {"es": "Manzana"}},
    {"type": "text", "name": "cat_predio", "label": {"es": "Predio"}},
    {"type": "text", "name": "cat_mejora",
     "label": {"es": "Mejora / Prop. horizontal"}},
    {"type": "end_group", "name": ""},

    # ── Sección 3 (continuación): características de la edificación ──────
    {"type": "integer", "name": "pisos_sobre",
     "label": {"es": "Niveles sobre el terreno"}, "required": "yes",
     "relevant": INSPECTED, "constraint": ". >= 1 and . <= 50",
     "constraint_message": {"es": "Debe estar entre 1 y 50"}},
    {"type": "integer", "name": "sotanos", "label": {"es": "Sótanos"},
     "relevant": INSPECTED, "constraint": ". >= 0 and . <= 10",
     "constraint_message": {"es": "Debe estar entre 0 y 10"}},
    {"type": "select_one usos", "name": "uso_predominante",
     "label": {"es": "Uso predominante de la edificación"}, "required": "yes",
     "relevant": INSPECTED, "appearance": "minimal"},
    {"type": "select_one usos", "name": "uso_planta_baja",
     "label": {"es": "Uso de la planta baja"}, "relevant": INSPECTED,
     "appearance": "minimal"},
    {"type": "decimal", "name": "frente_m",
     "label": {"es": "Frente aproximado (m)"}, "relevant": INSPECTED,
     "constraint": ". > 0 and . < 1000",
     "constraint_message": {"es": "Valor en metros, mayor que 0"}},
    {"type": "decimal", "name": "fondo_m",
     "label": {"es": "Fondo aproximado (m)"}, "relevant": INSPECTED,
     "constraint": ". > 0 and . < 1000",
     "constraint_message": {"es": "Valor en metros, mayor que 0"}},

    # ── Sección 4: descripción de la estructura ──────────────────────────
    {"type": "select_one sistemas_estructurales", "name": "sistema_estructural",
     "label": {"es": "Sistema estructural"}, "required": "yes",
     "relevant": INSPECTED, "appearance": "minimal"},
    {"type": "select_one tipos_entrepiso", "name": "tipo_entrepiso",
     "label": {"es": "Tipo de entrepiso"}, "relevant": INSPECTED,
     "appearance": "minimal"},
    {"type": "select_one rangos_ano", "name": "rango_ano",
     "label": {"es": "Año de construcción"}, "required": "yes",
     "relevant": INSPECTED},

    # ── Sección 5.1: estabilidad global (observaciones) ──────────────────
    {"type": "select_one colapsos", "name": "colapso",
     "label": {"es": "Colapso"}, "required": "yes", "relevant": INSPECTED},
    {"type": "select_one inclinaciones", "name": "inclinacion",
     "label": {"es": "Inclinación de la edificación o de un piso"},
     "required": "yes", "relevant": INSPECTED},

    # ── Sección 5.3: daños estructurales (piso de mayor daño) ────────────
    {"type": "integer", "name": "piso_mayor_dano",
     "label": {"es": "¿Cuál es el piso de mayor daño?"}, "required": "yes",
     "relevant": f"{INSPECTED} and ${{colapso}} != 'total'",
     "constraint": ". >= 0 and . <= 50",
     "constraint_message": {"es": "0 = sótano; máximo 50"},
     "hint": {"es": "La matriz de daño se evalúa en ese piso"}},
    *damage_pair("vigas", "vigas", PORTICOS),
    *damage_pair("columnas", "columnas", PORTICOS),
    *damage_pair("nudos", "nudos (unión viga-columna)", NUDOS),
    *damage_pair("conexiones", "conexiones", CONEXIONES),
    *damage_pair("muros", "muros estructurales", MUROS_CR),
    *damage_pair("muros_portantes", "muros portantes", MUROS_PORTANTES),
    *damage_pair("columnetas", "columnetas de confinamiento", CONFINADA),
    *damage_pair("vigas_confinamiento", "vigas de confinamiento", CONFINADA),
    *damage_pair("entrepisos", "entrepisos",
                 PORTICOS + MUROS_PORTANTES),

    # señales rápidas para priorización/IA (no es el registro de daño oficial)
    {"type": "select_multiple senales", "name": "senales_alarma",
     "label": {"es": "Señales de alarma observadas"}, "required": "yes",
     "relevant": INSPECTED,
     "hint": {"es": "Marcar todas las que apliquen; si no hay, marcar «Ninguna»"},
     "constraint": "not(selected(., 'ninguna') and count-selected(.) > 1)",
     "constraint_message": {"es": "«Ninguna» no puede combinarse con otras señales"}},

    # ── Sección 6: porcentaje global de daño ─────────────────────────────
    {"type": "select_one danos_globales", "name": "dano_global",
     "label": {"es": "Porcentaje global de daño de la edificación"},
     "required": "yes", "relevant": INSPECTED},

    # ── Sección 17: fotografías ──────────────────────────────────────────
    {"type": "image", "name": "foto_fachada",
     "label": {"es": "Foto: fachada completa"}, "required": "yes",
     "hint": {"es": "Desde el frente, que se vea todo el edificio"},
     "parameters": "max-pixels=1600"},
    {"type": "image", "name": "foto_esquina_1",
     "label": {"es": "Foto: esquina 1"}, "required": "yes",
     "parameters": "max-pixels=1600"},
    {"type": "image", "name": "foto_esquina_2",
     "label": {"es": "Foto: esquina 2"}, "required": "yes",
     "parameters": "max-pixels=1600"},
    {"type": "image", "name": "foto_esquina_3",
     "label": {"es": "Foto: esquina 3 (si es accesible)"},
     "parameters": "max-pixels=1600"},
    {"type": "image", "name": "foto_esquina_4",
     "label": {"es": "Foto: esquina 4 (si es accesible)"},
     "parameters": "max-pixels=1600"},
    {"type": "image", "name": "foto_grieta",
     "label": {"es": "Foto: peor grieta, de cerca"},
     "required": "yes", "relevant": INSPECTED,
     "hint": {"es": "Poner una moneda junto a la grieta como referencia de escala"},
     "parameters": "max-pixels=2048"},
    {"type": "image", "name": "foto_columnas",
     "label": {"es": "Foto: columnas del primer piso"},
     "required": "yes", "relevant": INSPECTED,
     "parameters": "max-pixels=1600"},
]

# ── Listas de opciones ───────────────────────────────────────────────────────

confirmaciones = [
    ("si", {"es": "Sí"}),
    ("no_aplica", {"es": "No aplica (inmueble desocupado o sin acceso)"}),
]

tipos_inspeccion = [
    ("exterior", {"es": "Solo exterior"}),
    ("parcial", {"es": "Parcial (exterior + algunas zonas interiores)"}),
    ("completa", {"es": "Completa"}),
    ("no_inspeccionada", {"es": "No se inspeccionó"}),
]

motivos_no_inspeccion = [
    ("no_permitido", {"es": "No se permitió el acceso"}),
    ("desocupada", {"es": "Edificación desocupada"}),
    ("colapso", {"es": "Colapso total"}),
    ("demolida", {"es": "Ya demolida"}),
    ("otro", {"es": "Otro"}),
]

# Las listas territoriales (municipios, divisiones, barrios) viven en
# kobo/media/*.csv como media files del formulario (HANDOFF-T5b): corregir
# una lista no exige redesplegar. Aquí solo quedan listas estables.
tipo_zona = [
    ("urbano", {"es": "Urbana"}),
    ("rural", {"es": "Rural"}),
]

via_tipo = [
    ("carrera", {"es": "Carrera"}),
    ("calle", {"es": "Calle"}),
    ("transversal", {"es": "Transversal"}),
    ("diagonal", {"es": "Diagonal"}),
    ("avenida", {"es": "Avenida"}),
    ("otra", {"es": "Otra"}),
]

# Códigos oficiales AIS (sección 4) — el `name` ES el código
sistemas_estructurales = [
    ("11", {"es": "Concreto: pórtico"}),
    ("12", {"es": "Concreto: muros estructurales"}),
    ("13", {"es": "Concreto: sistema dual (pórtico + muros)"}),
    ("14", {"es": "Concreto: prefabricado"}),
    ("21", {"es": "Mampostería confinada (con vigas y columnas de amarre)"}),
    ("22", {"es": "Mampostería reforzada"}),
    ("23", {"es": "Mampostería no reforzada (sin amarres)"}),
    ("31", {"es": "Acero: pórticos arriostrados"}),
    ("32", {"es": "Acero: pórticos no arriostrados"}),
    ("33", {"es": "Acero: pórticos en celosía"}),
    ("41", {"es": "Madera: pórticos y panel en madera"}),
    ("42", {"es": "Madera: pórticos con paneles de otros materiales"}),
    ("51", {"es": "Muros en bahareque"}),
    ("52", {"es": "Muros en tapia"}),
    ("50", {"es": "Mixta"}),
    ("60", {"es": "Otros / no identificable"}),
]

tipos_entrepiso = [
    ("11", {"es": "Concreto: placa maciza"}),
    ("12", {"es": "Concreto: placa aligerada"}),
    ("13", {"es": "Concreto: reticular celulado"}),
    ("21", {"es": "Acero: vigas alma llena con conectores"}),
    ("22", {"es": "Acero: vigas alma llena sin conectores"}),
    ("23", {"es": "Acero: cerchas"}),
    ("31", {"es": "Madera: vigas"}),
    ("32", {"es": "Madera: cerchas"}),
    ("40", {"es": "Mixta"}),
    ("50", {"es": "Otros / no se sabe"}),
]

usos = [
    ("1", {"es": "Residencial"}), ("2", {"es": "Comercial"}),
    ("3", {"es": "Educacional"}), ("4", {"es": "Salud"}),
    ("5", {"es": "Hotelero"}), ("6", {"es": "Oficinas"}),
    ("7", {"es": "Industrial"}), ("8", {"es": "Institucional"}),
    ("9", {"es": "Bodegas"}), ("10", {"es": "Estacionamientos"}),
    ("11", {"es": "Otros"}),
]

rangos_ano = [
    ("1", {"es": "Antes de 1950"}),
    ("2", {"es": "1950 – 1982"}),
    ("3", {"es": "1982 – 1997"}),
    ("4", {"es": "1998 en adelante"}),
]

colapsos = [
    ("total", {"es": "Colapso total"}),
    ("parcial_mayor_50", {"es": "Colapso parcial (50% o más)"}),
    ("parcial_menor_50", {"es": "Colapso parcial (menos del 50%)"}),
    ("ninguno", {"es": "Ninguno"}),
]

inclinaciones = [
    ("evidente", {"es": "Inclinación evidente"}),
    ("dudas", {"es": "Hay dudas"}),
    ("ninguna", {"es": "Ninguna"}),
]

niveles_dano = [
    ("ninguno", {"es": "Ninguno / muy leve"}),
    ("leve", {"es": "Leve"}),
    ("moderado", {"es": "Moderado"}),
    ("fuerte", {"es": "Fuerte"}),
    ("severo", {"es": "Severo"}),
]

danos_globales = [
    ("ninguno", {"es": "Ninguno"}),
    ("0_10", {"es": "0 – 10 %"}),
    ("10_30", {"es": "10 – 30 %"}),
    ("30_60", {"es": "30 – 60 %"}),
    ("60_100", {"es": "60 – 100 %"}),
    ("100", {"es": "100 % (colapso)"}),
]

senales = [
    ("grietas_x", {"es": "Grietas en X en muros"}),
    ("grietas_horizontales_base", {"es": "Grietas horizontales en base de columnas"}),
    ("refuerzo_expuesto", {"es": "Refuerzo (varillas) expuesto"}),
    ("pisos_desnivelados", {"es": "Pisos desnivelados o inclinados"}),
    ("separacion_muro_estructura", {"es": "Separación entre muros y estructura"}),
    ("grieta_ancha", {"es": "Grieta llamativamente ancha (fotografiar con escala)"}),
    ("ninguna", {"es": "Ninguna"}),
]

CHOICES = [
    ("confirmaciones", confirmaciones),
    ("tipos_inspeccion", tipos_inspeccion),
    ("motivos_no_inspeccion", motivos_no_inspeccion),
    ("tipo_zona", tipo_zona),
    ("via_tipo", via_tipo),
    ("sistemas_estructurales", sistemas_estructurales),
    ("tipos_entrepiso", tipos_entrepiso),
    ("usos", usos),
    ("rangos_ano", rangos_ano),
    ("colapsos", colapsos),
    ("inclinaciones", inclinaciones),
    ("niveles_dano", niveles_dano),
    ("danos_globales", danos_globales),
    ("senales", senales),
]


def survey_columns():
    cols = list(PLAIN_COLS)
    for c in I18N_COLS:
        cols += [f"{c}::{lang}" for lang in LANGS.values()]
    return cols


def survey_row(row):
    out = [row.get(c, "") for c in PLAIN_COLS]
    for c in I18N_COLS:
        val = row.get(c, {})
        out += [val.get(code, "") for code in LANGS]
    return out


wb = Workbook()

ws = wb.active
ws.title = "survey"
ws.append(survey_columns())
for row in survey:
    ws.append(survey_row(row))

ws = wb.create_sheet("choices")
ws.append(["list_name", "name"]
          + [f"label::{lang}" for lang in LANGS.values()])
for list_name, items in CHOICES:
    for name, label in items:
        ws.append([list_name, name]
                  + [label.get(code, "") for code in LANGS])

ws = wb.create_sheet("settings")
ws.append(["form_title", "form_id", "version", "default_language"])
ws.append(["SafeTag — Formulario Único AIS (v1)", "safetag_ais", "2026081701",
           DEFAULT_LANG])

out = Path(__file__).parent / "ais.xlsx"
wb.save(out)
print(f"ok → {out}")
