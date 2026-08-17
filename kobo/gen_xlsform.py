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
              "constraint", "parameters"]

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

    # aviso de privacidad (T6 lo ampliará con consentimiento formal)
    {"type": "note", "name": "aviso_privacidad",
     "label": {"es": "Esta inspección registra ubicación, características y "
                     "fotos de la edificación para priorizar la evaluación "
                     "estructural post-sismo. Los datos se tratan bajo la "
                     "Ley 1581 de 2012."}},

    # ── Sección 2: tipo de inspección ────────────────────────────────────
    {"type": "select_one tipos_inspeccion", "name": "tipo_inspeccion",
     "label": {"es": "Tipo de inspección"}, "required": "yes"},
    {"type": "select_one motivos_no_inspeccion", "name": "motivo_no_inspeccion",
     "label": {"es": "¿Por qué no se inspeccionó?"}, "required": "yes",
     "relevant": "${tipo_inspeccion} = 'no_inspeccionada'"},

    # ── Sección 1: identificación catastral ──────────────────────────────
    {"type": "select_one comunas", "name": "comuna",
     "label": {"es": "Comuna"}, "required": "yes", "appearance": "minimal"},
    {"type": "text", "name": "barrio", "label": {"es": "Barrio"},
     "hint": {"es": "Nombre del barrio dentro de la comuna"}},
    {"type": "text", "name": "id_catastral",
     "label": {"es": "Identificación catastral"},
     "hint": {"es": "sector-manzana-predio-mejora (IGAC), si se conoce"}},

    # ── Sección 3: identificación de la edificación ──────────────────────
    {"type": "text", "name": "direccion",
     "label": {"es": "Dirección de la edificación"}, "required": "yes",
     "hint": {"es": "Como aparece en la placa, o la más aproximada"}},
    {"type": "text", "name": "nombre_edificacion",
     "label": {"es": "Nombre de la edificación (si tiene)"}},
    {"type": "geopoint", "name": "gps", "label": {"es": "Ubicación GPS"},
     "required": "yes",
     "hint": {"es": "Capturar de pie frente a la edificación, con cielo visible"}},
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

comunas = [
    ("centro", {"es": "Centro"}), ("rio_otun", {"es": "Río Otún"}),
    ("villavicencio", {"es": "Villavicencio"}),
    ("villa_santana", {"es": "Villa Santana"}), ("oriente", {"es": "Oriente"}),
    ("universidad", {"es": "Universidad"}), ("boston", {"es": "Boston"}),
    ("jardin", {"es": "Jardín"}), ("cuba", {"es": "Cuba"}),
    ("consota", {"es": "Consotá"}), ("el_oso", {"es": "El Oso"}),
    ("san_joaquin", {"es": "San Joaquín"}),
    ("perla_del_otun", {"es": "Perla del Otún"}),
    ("olimpica", {"es": "Olímpica"}), ("ferrocarril", {"es": "Ferrocarril"}),
    ("del_cafe", {"es": "Del Café"}), ("el_poblado", {"es": "El Poblado"}),
    ("el_rocio", {"es": "El Rocío"}), ("san_nicolas", {"es": "San Nicolás"}),
    ("otro", {"es": "Otra / zona rural"}),
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
    ("tipos_inspeccion", tipos_inspeccion),
    ("motivos_no_inspeccion", motivos_no_inspeccion),
    ("comunas", comunas),
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
ws.append(["list_name", "name"] + [f"label::{lang}" for lang in LANGS.values()])
for list_name, items in CHOICES:
    for name, label in items:
        ws.append([list_name, name] + [label.get(code, "") for code in LANGS])

ws = wb.create_sheet("settings")
ws.append(["form_title", "form_id", "version", "default_language"])
ws.append(["SafeTag — Formulario Único AIS (v1)", "safetag_ais", "2026081603",
           DEFAULT_LANG])

out = Path(__file__).parent / "ais.xlsx"
wb.save(out)
print(f"ok → {out}")
