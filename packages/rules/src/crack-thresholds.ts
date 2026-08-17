// Umbrales de ancho de grieta por sistema estructural — manual AIS, sección 5.3.
// Ver docs/marco-normativo-y-negocio.md §2 ("Umbrales de grieta").
//
// NO existe un umbral global: "grietas > 3 mm → evacuar" es falso como regla
// general. El umbral depende del material, y los niveles altos incluyen
// criterios cualitativos (refuerzo expuesto, desprendimiento) además del ancho.
// Este módulo es también el ground truth del modelo de visión de fase 2, que
// debe recibir el sistema estructural como input.

import { materialFamily, type AisStructuralSystem } from "./structural-systems";

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
  qualitative?: string;
}

const CONCRETE: CrackThreshold[] = [
  { level: "none", minWidthMm: null, maxWidthMm: 0.2 },
  { level: "light", minWidthMm: 0.2, maxWidthMm: 1.0 },
  { level: "moderate", minWidthMm: 1.0, maxWidthMm: 2.0,
    qualitative: "pérdida incipiente del recubrimiento" },
  { level: "heavy", minWidthMm: 2.0, maxWidthMm: null,
    qualitative: "pérdida de recubrimiento, refuerzo longitudinal expuesto" },
  { level: "severe", minWidthMm: null, maxWidthMm: null,
    qualitative:
      "aplastamiento del concreto, agrietamiento del núcleo, pandeo de barras" },
];

const MASONRY: CrackThreshold[] = [
  { level: "none", minWidthMm: null, maxWidthMm: 0.2 },
  { level: "light", minWidthMm: 0.2, maxWidthMm: 1.0 },
  { level: "moderate", minWidthMm: 1.0, maxWidthMm: 3.0,
    qualitative: "inicio de agrietamiento diagonal en muros confinados" },
  { level: "heavy", minWidthMm: 3.0, maxWidthMm: null,
    qualitative: "agrietamiento diagonal severo, dislocación de piezas" },
  { level: "severe", minWidthMm: null, maxWidthMm: null,
    qualitative:
      "desprendimiento de piezas, aplastamiento local, desplome del muro" },
];

// Tapia pisada / adobe / bahareque: el material tolera más fisura
const EARTHEN: CrackThreshold[] = [
  { level: "none", minWidthMm: null, maxWidthMm: 0.4 },
  { level: "light", minWidthMm: 0.4, maxWidthMm: 2.0 },
  { level: "moderate", minWidthMm: 2.0, maxWidthMm: 4.0 },
  { level: "heavy", minWidthMm: 4.0, maxWidthMm: null,
    qualitative: "desplazamiento fuera del plano de pocos milímetros" },
  { level: "severe", minWidthMm: null, maxWidthMm: null,
    qualitative: "aplastamiento local, deformación, desplome apreciable" },
];

/**
 * Rangos de ancho de grieta para el sistema estructural dado (código AIS).
 * Devuelve null para acero, madera, mixta y otros: el manual no define
 * criterios de ancho de grieta para esos sistemas (se evalúan por conexiones,
 * pandeo, etc.), y ese caso debe manejarse explícitamente, no con un default.
 */
export function damageLevelThresholds(
  structuralSystem: AisStructuralSystem,
): CrackThreshold[] | null {
  switch (materialFamily(structuralSystem)) {
    case "concrete":
      return CONCRETE;
    case "masonry":
      return MASONRY;
    case "earthen":
      return EARTHEN;
    default:
      return null;
  }
}
