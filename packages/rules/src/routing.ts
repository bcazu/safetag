// Enrutamiento de casos por especialidad — obligatorio por normativa, no UX.
// Ver docs/HANDOFF.md (T4) y docs/marco-normativo-y-negocio.md §2 y §3.2:
//   * Edificaciones indispensables o de atención a la comunidad → ingeniero
//     estructural (metodología AIS).
//   * Problemas de suelos → especialista en geotecnia (metodología AIS y
//     Ley 842 art. 19: la especialidad debe corresponder a la materia).

export type ReviewerSpecialty = "structural" | "geotechnical" | "general";

// building_use (códigos AIS): 3 educacional, 4 salud, 8 institucional
const STRUCTURAL_ONLY_USES = new Set([3, 4, 8]);

export type GeotechnicalFinding = "general" | "localized" | "none";

export interface CaseForRouting {
  buildingUse?: number | null;
  /** Contenido de cases.geotechnical (sección 5.2 del formulario) */
  geotechnical?: {
    settlement?: GeotechnicalFinding | null;
    slopeFailure?: GeotechnicalFinding | null;
  } | null;
}

function hasFinding(f: GeotechnicalFinding | null | undefined): boolean {
  return f != null && f !== "none";
}

/**
 * Especialidades requeridas para dictaminar el caso. Lista vacía = cualquier
 * revisor habilitado ('general' basta). Puede exigir ambas a la vez: un
 * colegio con falla de talud necesita estructural Y geotecnista (o visita
 * especializada).
 */
export function routeCase(c: CaseForRouting): ReviewerSpecialty[] {
  const required: ReviewerSpecialty[] = [];

  if (c.buildingUse != null && STRUCTURAL_ONLY_USES.has(c.buildingUse)) {
    required.push("structural");
  }
  if (
    hasFinding(c.geotechnical?.settlement) ||
    hasFinding(c.geotechnical?.slopeFailure)
  ) {
    required.push("geotechnical");
  }

  return required;
}
