// Mirrors of ClearanceOutput and related models from the Python backend.
// Keep in sync with clearpath/models/clinical.py.

export type Disposition =
  | "no_clearance_needed"
  | "clearance_recommended"
  | "specialist_required"
  | "anesthesia_review_required"
  | "insufficient_information";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface SpecialistFinding {
  specialty: string;
  last_visit_days_ago: number | null;
  status: string;
  summary: string;
  doctor_name: string | null;
}

export interface ClearanceOutput {
  disposition: Disposition;
  risk_level: RiskLevel;
  risk_score: number;
  rcri_score: number;
  confidence: number;
  recommended_specialties: string[];
  triggering_factors: string[];
  active_medications: string[];
  clinical_summary: string;
  recommended_next_steps: string[];
  specialist_findings: SpecialistFinding[];
  missing_information: string[];
  clearance_letter: string | null;
  schema_version: string;
  model_version: string;
  generated_at: string;
}

export interface PatientSummary {
  id: string;
  name: string;
  dob: string | null;
  gender: string | null;
  pcpDoctor: string | null;
  procedureHint: string | null;
  conditionCount: number;
  medicationCount: number;
}

export interface ClearanceResponse {
  clearance: ClearanceOutput;
  markdown: string;
  patientName: string;
}

export interface ChatTurn {
  q: string;
  a: string;
}
