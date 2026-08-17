// Códigos de sistema estructural del Formulario Único AIS, sección 4.
// Son los valores válidos de cases.structural_system (migración 0004).

export const AIS_STRUCTURAL_SYSTEMS = {
  "11": "Pórtico de concreto",
  "12": "Muros estructurales de concreto",
  "13": "Sistemas duales",
  "14": "Prefabricado",
  "21": "Mampostería confinada",
  "22": "Mampostería reforzada",
  "23": "Mampostería no reforzada",
  "31": "Pórticos de acero arriostrados",
  "32": "Pórticos de acero no arriostrados",
  "33": "Pórticos de acero en celosía",
  "41": "Pórticos y panel en madera",
  "42": "Pórticos de madera con paneles de otros materiales",
  "51": "Muros en bahareque",
  "52": "Muros en tapia",
  "50": "Mixta",
  "60": "Otros",
} as const;

export type AisStructuralSystem = keyof typeof AIS_STRUCTURAL_SYSTEMS;

// Nota: aquí NO hay clasificador por "familia de material" a propósito.
// Agrupar 51 (bahareque) con 52 (tapia) llevó a aplicarle a bahareque los
// umbrales de tapia, y la tabla 3-8 (bahareque) no está verificada. Los
// umbrales se resuelven por código exacto en data/crack-thresholds.json.
