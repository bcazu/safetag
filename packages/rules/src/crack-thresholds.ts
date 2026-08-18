// Umbrales de ancho de grieta / niveles de daño por sistema estructural —
// manual AIS, sección 5.3 y tablas 3-6 a 3-11. Ver
// docs/manual-ais-tablas-verificadas.md (fuente de verdad de las tablas 3-8 a
// 3-11, verificadas el 17-ago-2026 contra el PDF completo en
// docs/referencias/) y docs/marco-normativo-y-negocio.md.
//
// NO existe un umbral global: "grietas > 3 mm → evacuar" es falso como regla
// general. El umbral depende del material, y varias tablas son puramente
// CUALITATIVAS (bahareque 3-8, acero 3-9, madera 3-10): en ellas todos los
// anchos son null y el nivel se decide por el criterio descriptivo. PROHIBIDO
// fabricar anchos en mm para esas tablas.
//
// Los umbrales son DATOS versionados (data/crack-thresholds.json), no
// constantes. Los sistemas sin tabla propia en el manual (50 mixta, 60 otros)
// devuelven 'unknown': la UI pide clasificación manual del nivel, sin
// sugerencia automática.
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
  /**
   * Criterio por variante del sistema cuando el manual distingue subtipos
   * (tabla 3-8: bahareque `non_cemented` | `cemented`). Solo presente en los
   * niveles donde los criterios difieren; `qualitative` conserva el texto
   * combinado para consumidores que no conocen variantes.
   */
  variants?: Record<string, string>;
}

export type ThresholdLookup =
  | {
      status: "verified";
      levels: CrackThreshold[];
      /** A qué material corresponde la tabla verificada */
      appliesTo: string;
      /** Etiquetas de las variantes del sistema, si la tabla las distingue */
      variantLabels?: Record<string, string>;
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

function lookupTable(key: TableKey): ThresholdLookup {
  const table = data.tables[key] as {
    appliesTo: string;
    levels: CrackThreshold[];
    variantLabels?: Record<string, string>;
  };
  return {
    status: "verified",
    levels: table.levels,
    appliesTo: table.appliesTo,
    ...(table.variantLabels ? { variantLabels: table.variantLabels } : {}),
  };
}

/**
 * Rangos de ancho de grieta / criterios de nivel de daño para el sistema
 * estructural dado (código AIS).
 *
 * 'unknown' ⇒ el sistema no tiene tabla propia en el manual (mixta, otros):
 * la UI pide al revisor clasificar el nivel manualmente.
 */
export function damageLevelThresholds(
  structuralSystem: AisStructuralSystem,
): ThresholdLookup {
  const entry = systems[structuralSystem];
  if (!entry.table) {
    return { status: "unknown", reason: entry.todo ?? "sin tabla verificada" };
  }
  return lookupTable(entry.table);
}

/**
 * Niveles de daño en entrepisos (tabla 3-11). Los entrepisos no son un
 * sistema estructural sino un elemento: se consultan aparte del sistema.
 */
export function floorSlabThresholds(): ThresholdLookup {
  return lookupTable(data.floorSlabs.table as TableKey);
}

/** Versión y fuente de los datos de umbrales (para auditoría/UI) */
export const CRACK_THRESHOLDS_META = {
  version: data.version,
  updated: data.updated,
  source: data.source,
} as const;
