// Criterios para asignar cada riesgo — manual AIS, tablas 3-2 y 3-3
// (verificadas). Son GUÍA para el revisor en /revisar: en v1 los cuatro
// riesgos se asignan manualmente y el sistema solo deriva el color
// (deriveHabitability). Los riesgos estructural (tabla 3-13) y no
// estructural (tabla 3-21) no tienen criterios verificados: sin sugerencia
// automática hasta tener la fuente primaria. PROHIBIDO inventar esos valores.

import data from "./data/risk-criteria.json";
import type { RiskLevel } from "./habitability";

export type RiskCriteria =
  | {
      status: "verified";
      /** Tabla del manual AIS de donde salen los criterios */
      table: string;
      /** Texto guía por nivel de riesgo, para mostrar al revisor */
      criteria: Record<RiskLevel, string>;
      /** Regla adicional (p. ej. inclinación), si existe */
      tiltRule?: string;
    }
  | {
      status: "unknown";
      /** Incluye el TODO(tabla 3-X) rastreable */
      todo: string;
    };

export const RISK_CRITERIA: {
  globalStability: RiskCriteria;
  geotechnical: RiskCriteria;
  structural: RiskCriteria;
  nonstructural: RiskCriteria;
} = {
  globalStability: {
    status: "verified",
    table: data.globalStability.table,
    criteria: data.globalStability.criteria,
    tiltRule: data.globalStability.tiltRule,
  },
  geotechnical: {
    status: "verified",
    table: data.geotechnical.table,
    criteria: data.geotechnical.criteria,
  },
  structural: { status: "unknown", todo: data.structural.todo },
  nonstructural: { status: "unknown", todo: data.nonstructural.todo },
};

/** Versión y fuente de los criterios (para auditoría/UI) */
export const RISK_CRITERIA_META = {
  version: data.version,
  updated: data.updated,
  source: data.source,
} as const;
