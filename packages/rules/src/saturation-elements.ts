// Elementos que saturan el daño global — manual AIS, tabla 3-12 [p. 49],
// verificada en docs/manual-ais-tablas-verificadas.md. Daño SEVERO en estos
// elementos puede comprometer toda la edificación (saturación del daño
// global → posible evacuación inmediata).
//
// SOLO DATO versionado para que la UI del revisor lo muestre como guía:
// aquí NO hay lógica que lo aplique (la saturación la juzga el revisor).
// El mapeo 'systems' (códigos AIS de la sección 4) es de SafeTag: los
// sistemas 12, 14, 50 y 60 no tienen fila propia en la tabla del manual y
// quedan sin mapeo a propósito — PROHIBIDO inventarles una.

import data from "./data/saturation-elements.json";
import type { AisStructuralSystem } from "./structural-systems";

export interface SaturationRow {
  /** Identificador estable de la fila (en inglés, como el resto de la BD) */
  key: string;
  /** Códigos AIS de sistema estructural cubiertos por la fila (mapeo SafeTag) */
  systems: AisStructuralSystem[];
  /** Nombre del sistema tal como aparece en la tabla 3-12 */
  systemLabel: string;
  /** Elementos cuyo daño severo satura el daño global (texto del manual) */
  elements: string;
}

/** Tabla 3-12 completa, en el orden del manual */
export const SATURATION_ELEMENTS: readonly SaturationRow[] =
  data.rows as SaturationRow[];

/** Versión y fuente del dato (para auditoría/UI) */
export const SATURATION_ELEMENTS_META = {
  version: data.version,
  updated: data.updated,
  source: data.source,
  note: data.note,
} as const;
