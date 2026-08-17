"""Genera kobo/atc20.xlsx (XLSForm) para el formulario SafeTag ATC-20.

Uso:
    pip install openpyxl pyxform   # en un venv
    python kobo/gen_xlsform.py
    xls2xform kobo/atc20.xlsx /tmp/atc20.xml   # validar

Multiidioma: XLSForm soporta varios idiomas con columnas `label::Idioma (cod)`.
Para sumar un idioma, añadirlo a LANGS y completar los diccionarios {"es": ...}
con la clave nueva (p. ej. "en"). Kobo muestra un selector de idioma en
KoboCollect y Enketo automáticamente.
"""
from pathlib import Path

from openpyxl import Workbook

# código → etiqueta de columna XLSForm
LANGS = {"es": "Español (es)"}
DEFAULT_LANG = "Español (es)"

# columnas traducibles → se expanden a `col::Idioma (cod)` por cada idioma
I18N_COLS = ["label", "hint", "constraint_message"]
PLAIN_COLS = ["type", "name", "required", "appearance", "relevant",
              "constraint", "parameters"]

survey = [
    # metadatos
    {"type": "start", "name": "start"},
    {"type": "end", "name": "end"},
    {"type": "start-geopoint", "name": "gps_fondo"},  # GPS automático de respaldo

    # 1. ubicación
    {"type": "text", "name": "direccion",
     "label": {"es": "Dirección de la edificación"}, "required": "yes",
     "hint": {"es": "Como aparece en la placa, o la más aproximada"}},
    {"type": "select_one barrios", "name": "barrio",
     "label": {"es": "Barrio / comuna"}, "required": "yes",
     "appearance": "minimal"},
    {"type": "text", "name": "barrio_otro", "label": {"es": "¿Cuál barrio?"},
     "required": "yes", "relevant": "${barrio} = 'otro'"},
    {"type": "geopoint", "name": "gps", "label": {"es": "Ubicación GPS"},
     "required": "yes",
     "hint": {"es": "Capturar de pie frente a la edificación, con cielo visible"}},

    # 2. caracterización estructural
    {"type": "select_one sistemas", "name": "sistema_constructivo",
     "label": {"es": "Sistema constructivo"}, "required": "yes"},
    {"type": "integer", "name": "num_pisos",
     "label": {"es": "Número de pisos"}, "required": "yes",
     "constraint": ". >= 1 and . <= 50",
     "constraint_message": {"es": "Debe estar entre 1 y 50"}},
    {"type": "select_multiple senales", "name": "senales_alarma",
     "label": {"es": "Señales de alarma observadas"}, "required": "yes",
     "hint": {"es": "Marcar todas las que apliquen; si no hay, marcar «Ninguna»"},
     "constraint": "not(selected(., 'ninguna') and count-selected(.) > 1)",
     "constraint_message": {"es": "«Ninguna» no puede combinarse con otras señales"}},

    # 3. secuencia de fotos (los nombres se mapean a photo_type en el webhook)
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
     "label": {"es": "Foto: peor grieta, de cerca"}, "required": "yes",
     "hint": {"es": "Poner una moneda junto a la grieta como referencia de escala"},
     "parameters": "max-pixels=2048"},
    {"type": "image", "name": "foto_columnas",
     "label": {"es": "Foto: columnas del primer piso"}, "required": "yes",
     "parameters": "max-pixels=1600"},
]

# Comunas urbanas de Pereira (más manejable que la lista completa de barrios;
# el detalle fino va en `direccion`)
barrios = [
    ("centro", {"es": "Centro"}),
    ("rio_otun", {"es": "Río Otún"}),
    ("villavicencio", {"es": "Villavicencio"}),
    ("villa_santana", {"es": "Villa Santana"}),
    ("oriente", {"es": "Oriente"}),
    ("universidad", {"es": "Universidad"}),
    ("boston", {"es": "Boston"}),
    ("jardin", {"es": "Jardín"}),
    ("cuba", {"es": "Cuba"}),
    ("consota", {"es": "Consotá"}),
    ("el_oso", {"es": "El Oso"}),
    ("san_joaquin", {"es": "San Joaquín"}),
    ("perla_del_otun", {"es": "Perla del Otún"}),
    ("olimpica", {"es": "Olímpica"}),
    ("ferrocarril", {"es": "Ferrocarril"}),
    ("del_cafe", {"es": "Del Café"}),
    ("el_poblado", {"es": "El Poblado"}),
    ("el_rocio", {"es": "El Rocío"}),
    ("san_nicolas", {"es": "San Nicolás"}),
    ("otro", {"es": "Otro / zona rural"}),
]

sistemas = [
    ("mamposteria_confinada",
     {"es": "Mampostería confinada (muros de ladrillo con vigas y columnas de amarre)"}),
    ("mamposteria_no_confinada",
     {"es": "Mampostería no confinada (muros de ladrillo sin amarres)"}),
    ("porticos_concreto",
     {"es": "Pórticos de concreto (estructura de columnas y vigas)"}),
    ("otro", {"es": "Otro / no identificable"}),
]

senales = [
    ("grietas_x", {"es": "Grietas en X en muros"}),
    ("grietas_horizontales_base", {"es": "Grietas horizontales en base de columnas"}),
    ("refuerzo_expuesto", {"es": "Refuerzo (varillas) expuesto"}),
    ("pisos_desnivelados", {"es": "Pisos desnivelados o inclinados"}),
    ("separacion_muro_estructura", {"es": "Separación entre muros y estructura"}),
    ("grietas_3mm", {"es": "Grietas de más de 3 mm de ancho"}),
    ("ninguna", {"es": "Ninguna"}),
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
for list_name, items in [("barrios", barrios), ("sistemas", sistemas), ("senales", senales)]:
    for name, label in items:
        ws.append([list_name, name] + [label.get(code, "") for code in LANGS])

ws = wb.create_sheet("settings")
ws.append(["form_title", "form_id", "version", "default_language"])
ws.append(["SafeTag — Evaluación rápida ATC-20", "safetag_atc20", "2026081602", DEFAULT_LANG])

out = Path(__file__).parent / "atc20.xlsx"
wb.save(out)
print(f"ok → {out}")
