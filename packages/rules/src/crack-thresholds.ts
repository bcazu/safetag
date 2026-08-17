// Umbrales de ancho de grieta por sistema estructural — manual AIS, sección 5.3.
// Ver docs/marco-normativo-y-negocio.md ("Umbrales de grieta" y "Vacíos
// conocidos") y docs/HANDOFF.md ("Vacíos conocidos — PROHIBIDO inventar").
//
// NO existe un umbral global: "grietas > 3 mm → evacuar" es falso como regla
// general. El umbral depende del material, y los niveles altos incluyen
// criterios cualitativos (refuerzo expuesto, desprendimiento) además del ancho.
//
// Los umbrales son DATOS versionados (data/crack-thresholds.json), no
// constantes: las tablas del manual que faltan por verificar (bahareque 3-8,
// acero 3-9, madera 3-10, entrepisos 3-11) están marcadas con TODO(tabla 3-X)
// en el JSON y este módulo devuelve 'unknown' para ellas — la UI debe pedir
// clasificación manual del nivel, sin sugerencia automática. PROHIBIDO
// rellenar esos huecos con valores plausibles.
//
// Este módulo es también el ground truth del modelo de visión de fase 2, que
// debe recibir el sistema estructural como input.

import data from "./data/crack-thresholds.json";
import type { AisStructuralSystem } from "./structural-systems";

export const DAMAGE_LEVELS = [
  "none",
  "light",
  "moderate",
  "heavy",
  "severe",
] as const;
export type DamageLevel = (typeof DAMAGE_LEVELS)[number];

export interface CrackThreshold {
  level: DamageLevel;
  /** Ancho mínimo en mm (inclusive); null si el nivel no se define por ancho */
  minWidthMm: number | null;
  /** Ancho máximo en mm (exclusivo); null = sin tope o no aplica */
  maxWidthMm: number | null;
  /** Criterio cualitativo adicional o sustituto del ancho */
  qualitative: string | null;
}

export type ThresholdLookup =
  | {
      status: "verified";
      levels: CrackThreshold[];
      /** A qué material corresponde la tabla verificada */
      appliesTo: string;
    }
  | {
      status: "unknown";
      /** Por qué no hay umbrales (incluye el TODO(tabla 3-X) rastreable) */
      reason: string;
    };

type TableKey = keyof typeof data.tables;

const systems = data.systems as Record<
  AisStructuralSystem,
  { table: TableKey | null; todo?: string }
>;

/**
 * Rangos de ancho de grieta para el sistema estructural dado (código AIS).
 *
 * 'unknown' ⇒ el manual define la tabla pero no está verificada (bahareque,
 * acero, madera) o el sistema no tiene tabla propia (mixta, otros): la UI
 * pide al revisor clasificar el nivel manualmente.
 */
export function damageLevelThresholds(
  structuralSystem: AisStructuralSystem,
): ThresholdLookup {
  const entry = systems[structuralSystem];
  if (!entry.table) {
    return { status: "unknown", reason: entry.todo ?? "sin tabla verificada" };
  }
  const table = data.tables[entry.table];
  return {
    status: "verified",
    levels: table.levels as CrackThreshold[],
    appliesTo: table.appliesTo,
  };
}

/** Versión y fuente de los datos de umbrales (para auditoría/UI) */
export const CRACK_THRESHOLDS_META = {
  version: data.version,
  updated: data.updated,
  source: data.source,
  /** TODO(tabla 3-11): entrepisos sin umbral verificado */
  floorSlabs: data.floorSlabs,
} as const;
