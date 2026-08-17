import type { AisStructuralSystem } from "@safetag/rules";

// Filas tal como las expone PostgREST (subconjunto que usa /revisar; las
// columnas PII contact/occupancy no llegan: excluidas por grant en 0006)
export interface CaseRow {
  id: string;
  address: string | null;
  neighborhood: string | null;
  commune: string | null;
  building_name: string | null;
  status: "pending" | "in_review" | "assessed";
  priority: number;
  created_at: string;
  assigned_reviewer_id: string | null;
  assigned_at: string | null;
  inspection_type: string | null;
  not_inspected_reason: string | null;
  structural_system: AisStructuralSystem | null;
  floor_system: string | null;
  year_range: number | null;
  building_use: number | null;
  ground_floor_use: number | null;
  floors_above: number | null;
  basements: number | null;
  worst_damaged_floor: number | null;
  global_damage_pct: string | null;
  warning_signs: string[] | null;
  structural_damage: {
    stability?: { collapse?: string | null; tilt?: string | null };
    elements?: Record<
      string,
      { level: string; extent_pct: number | null }
    >;
  } | null;
  geotechnical: {
    settlement?: "general" | "localized" | "none" | null;
    slopeFailure?: "general" | "localized" | "none" | null;
  } | null;
}

export interface ReviewerRow {
  id: string;
  user_id: string;
  name: string;
  professional_license: string;
  license_branch: string | null;
  license_status: "unverified" | "active" | "suspended";
  specialty: "structural" | "geotechnical" | "general" | null;
  can_recommend_demolition: boolean;
}

export interface AssessmentRow {
  id: string;
  reviewer_id: string;
  result: "green" | "yellow" | "orange" | "red" | "site_visit";
  derived_result: "green" | "yellow" | "orange" | "red" | null;
  risk_global_stability: string | null;
  risk_geotechnical: string | null;
  risk_structural: string | null;
  risk_nonstructural: string | null;
  override_justification: string | null;
  notes: string | null;
  safety_measures: string[] | null;
  specialist_visit: string[] | null;
  signed_at: string;
}

export interface PhotoRow {
  id: string;
  case_id: string;
  storage_path: string;
  photo_type: string | null;
}
