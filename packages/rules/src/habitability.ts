// Clasificación de habitabilidad — Formulario Único AIS, sección 7.
// Ver docs/marco-normativo-y-negocio.md §2 ("Algoritmo de habitabilidad").
//
// La habitabilidad NO la elige el revisor: se deriva de cuatro riesgos
// independientes. La UI muestra el resultado derivado; si el revisor se
// desvía, la BD exige justificación (constraint override_needs_reason).

export const RISK_LEVELS = [
  "low",
  "low_after_measures",
  "high",
  "very_high",
] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

// Tabla 3-21 (verificada en docs/manual-ais-tablas-verificadas.md): el riesgo
// NO estructural solo tiene TRES niveles — no existe 'very_high' para él.
export const NONSTRUCTURAL_RISK_LEVELS = [
  "low",
  "low_after_measures",
  "high",
] as const;
export type NonstructuralRiskLevel =
  (typeof NONSTRUCTURAL_RISK_LEVELS)[number];

export type RiskKind = keyof Risks;

/**
 * Niveles válidos para cada riesgo. La UI debe ofrecer SOLO estos:
 * los tres riesgos estructurales/geotécnicos usan los cuatro niveles;
 * el no estructural, tres (tabla 3-21).
 */
export function riskLevelsFor(risk: RiskKind): ReadonlyArray<RiskLevel> {
  return risk === "nonstructural" ? NONSTRUCTURAL_RISK_LEVELS : RISK_LEVELS;
}

export interface Risks {
  globalStability: RiskLevel;
  geotechnical: RiskLevel;
  structural: RiskLevel;
  nonstructural: RiskLevel;
}

/** Resultado derivado; 'site_visit' no existe aquí: es una decisión del revisor. */
export type HabitabilityResult = "green" | "yellow" | "orange" | "red";

/**
 * Semántica (respetarla en los textos de UI):
 *   green  — Habitable
 *   yellow — Uso restringido
 *   orange — No habitable: daño estructural, capacidad de carga reducida;
 *            no se ocupa hasta evaluación detallada
 *   red    — Peligro de colapso: evacuación del edificio y del entorno.
 *            Rojo NO significa demoler.
 *
 * Cascada de mayor a menor severidad; la primera condición que se cumple manda.
 */
export function deriveHabitability(risks: Risks): HabitabilityResult {
  const levels = [
    risks.globalStability,
    risks.geotechnical,
    risks.structural,
    risks.nonstructural,
  ];

  const highs = levels.filter((l) => l === "high").length;
  // Nota tabla 3-21: el riesgo no estructural NO contempla 'very_high'
  // (solo low | low_after_measures | high). Aquí se acepta igual de forma
  // defensiva por datos legados (dictámenes previos a la migración 0018):
  // si llegara, cae en rojo como cualquier 'very_high'.
  if (levels.includes("very_high") || highs > 2) return "red";
  if (highs > 0) return "orange";
  if (levels.includes("low_after_measures")) return "yellow";
  return "green";
}

/**
 * Resultados que puede elegir un revisor según el origen de la captura.
 * Principio no negociable: no hay verde definitivo sin inspección presencial —
 * en dictámenes remotos por foto la opción 'green' no debe existir.
 */
export function allowedResults(
  captureOrigin: "remote" | "field",
): ReadonlyArray<HabitabilityResult | "site_visit"> {
  return captureOrigin === "remote"
    ? ["yellow", "orange", "red", "site_visit"]
    : ["green", "yellow", "orange", "red", "site_visit"];
}
