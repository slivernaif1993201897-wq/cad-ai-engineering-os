export const REQUIREMENT_CATEGORIES = [
  "DIMENSION",
  "GEOMETRY",
  "MATERIAL",
  "LOAD",
  "CONSTRAINT",
  "INTERFACE",
  "TOLERANCE",
  "PERFORMANCE",
  "SAFETY",
  "MANUFACTURING",
  "ENVIRONMENT",
  "COST",
  "WEIGHT",
  "UNKNOWN",
] as const;

export type RequirementCategory = (typeof REQUIREMENT_CATEGORIES)[number];
export type RequirementState = "DRAFT" | "OPEN_QUESTION" | "CONFLICT" | "VALIDATED" | "SUPERSEDED" | "REJECTED";
export type RequirementSource = "NATURAL_LANGUAGE" | "CONVERSATIONAL_UPDATE" | "USER_CONFIRMED";
export type ValidationRuleType = "UNIT" | "RANGE" | "CONSTRAINT" | "CONFLICT" | "COMPLETENESS" | "GEOMETRIC_FEASIBILITY";

export interface ValidationRule {
  id: string;
  type: ValidationRuleType;
  description: string;
  passed: boolean;
}

export interface Requirement {
  requirement_id: string;
  category: RequirementCategory;
  parameter?: string;
  description: string;
  value?: number | string;
  unit?: string;
  min_value?: number;
  max_value?: number;
  tolerance?: number;
  source: RequirementSource;
  confidence: number;
  status: RequirementState;
  dependencies: string[];
  validation_rules: ValidationRule[];
  revision: number;
  supersedes?: string;
}

export interface OpenQuestion {
  id: string;
  question: string;
  whyItMatters: string;
  severity: "CRITICAL" | "IMPORTANT";
  relatedRequirementIds: string[];
}

export interface RequirementConflict {
  id: string;
  conflicting_requirements: string[];
  explanation: string;
  recommended_resolution: string;
}

export interface TraceabilityLink {
  id: string;
  from_type: "USER_REQUEST" | "REQUIREMENT" | "CAD_PARAMETER" | "CAD_FEATURE" | "GEOMETRY";
  from_id: string;
  to_type: "REQUIREMENT" | "CAD_PARAMETER" | "CAD_FEATURE" | "GEOMETRY";
  to_id: string;
  rationale: string;
}

export interface RequirementSet {
  id: string;
  revision: number;
  source_text: string;
  requirements: Requirement[];
  open_questions: OpenQuestion[];
  conflicts: RequirementConflict[];
  traceability: TraceabilityLink[];
  validation_status: "VALIDATED" | "OPEN_QUESTION" | "CONFLICT" | "DRAFT";
}

export interface RequirementParseResult {
  requirementSet: RequirementSet;
  normalizedText: string;
}

export interface UnitConversion {
  inputValue: number;
  inputUnit: string;
  normalizedValue: number;
  normalizedUnit: string;
  dimension: "LENGTH" | "ANGLE" | "MASS" | "FORCE" | "PRESSURE" | "TORQUE";
}
