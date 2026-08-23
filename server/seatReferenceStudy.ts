import { createHash } from "node:crypto";

export type ReferenceInputClassification = "EXPLICITLY_DOCUMENTED" | "DERIVED_FROM_DOCUMENTED_DATA" | "NOT_AVAILABLE";
export type ReferenceReproducibilityStatus = "REFERENCE_REPRODUCED" | "REFERENCE_CORRELATED" | "REFERENCE_NOT_REPRODUCIBLE" | "INSUFFICIENT_DATA";

export type ReferenceStudyInput = {
  sourceDocument: string;
  page: number;
  section: string;
  figureOrTable?: string;
  requirementId: string;
  category: "GEOMETRY" | "MATERIAL" | "MATERIAL_PROPERTIES" | "ELEMENT_TYPES" | "MESH_INFORMATION" | "FIXTURE_CONFIGURATION" | "BOUNDARY_CONDITIONS" | "LOAD_CASES" | "LOAD_MAGNITUDES" | "LOAD_DIRECTIONS" | "LOAD_APPLICATION_REGIONS" | "COORDINATE_SYSTEM" | "MEASUREMENT_POINTS" | "REFERENCE_RESULTS" | "VALIDATION_METRICS" | "TOLERANCES" | "EXPERIMENTAL_CONDITIONS" | "FE_MODEL_INFORMATION";
  value: string;
  unit: string;
  applicability: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  classification: ReferenceInputClassification;
};

export type ReferenceStudy = {
  id: string;
  title: string;
  analysisType: "STATIC_BACKREST" | "DYNAMIC_INTEGRATED_BELT";
  inputs: ReferenceStudyInput[];
  sourceHash: string;
};

export type ReferenceGeometryMetadata = {
  geometryDocumented: boolean;
  elementTypes: string[];
  connectionRepresentations: string[];
  dimensionsDocumented: boolean;
};

export type ReferenceMeasurementPoint = {
  id: string;
  sourceDocument: string;
  page: number;
  figureOrTable?: string;
  physicalLocation: string;
  coordinate?: [number, number, number];
};

export type PublishedReferenceResult = {
  metric: string;
  value: number;
  unit: string;
  sourceDocument: string;
  page: number;
  figureOrTable?: string;
  documentedTolerance?: number;
  toleranceKind?: "ACCEPTANCE" | "OBSERVED_ERROR";
};

export type ReferenceSimulationComparison = {
  status: "REQUIRED_INPUT" | "COMPARISON_ONLY" | "CORRELATED" | "NOT_CORRELATED";
  absoluteError?: number;
  relativeError?: number;
  reason?: string;
};

export type ReferenceReproducibilityAssessment = {
  status: ReferenceReproducibilityStatus;
  requiredInputs: string[];
  evidenceHash: string;
};

const canonicalHash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const BACKREST_STATIC_STRENGTH_STUDY: ReferenceStudy = (() => {
  const inputs: ReferenceStudyInput[] = [
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 2, section: "Seats Static Strength Analysis Model", requirementId: "BACKREST-ELEMENT-001", category: "ELEMENT_TYPES", value: "Shell and beam elements", unit: "N/A", applicability: "Published seat-frame FE model", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 2, section: "Seats Static Strength Analysis Model", requirementId: "BACKREST-CONNECTION-001", category: "FE_MODEL_INFORMATION", value: "Rigid connections for welding; beam elements for bolts", unit: "N/A", applicability: "Published simplified connection model", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 3, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-LOAD-530NM-001", category: "LOAD_MAGNITUDES", value: "530", unit: "Nm", applicability: "Published Chinese-seat backrest case at R-point", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 3, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-LOAD-1058N-001", category: "LOAD_MAGNITUDES", value: "1058", unit: "N", applicability: "Published conversion of 530 Nm case", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 3, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-LOAD-DIR-001", category: "LOAD_DIRECTIONS", value: "Horizontal direction to back", unit: "N/A", applicability: "Published backrest static case", confidence: "MEDIUM", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 3, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-LOAD-REGION-001", category: "LOAD_APPLICATION_REGIONS", value: "Beam midpoint of backrest frame", unit: "N/A", applicability: "Published backrest model", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 3, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-MEASUREMENT-001", category: "MEASUREMENT_POINTS", value: "16 measurement points illustrated", unit: "count", applicability: "Figure 2 physical experiment", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 4, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-STRESS-001", category: "REFERENCE_RESULTS", value: "254.9", unit: "MPa", applicability: "Maximum simulated stress of published model", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 4, section: "Experiment and Simulation Analysis", requirementId: "BACKREST-DISPLACEMENT-001", category: "REFERENCE_RESULTS", value: "17.68", unit: "mm", applicability: "Maximum displacement of published model", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 4, section: "Table 1", figureOrTable: "Table 1", requirementId: "BACKREST-CORRELATION-001", category: "VALIDATION_METRICS", value: "Maximum error 14.94; average error 8.83", unit: "percent", applicability: "Observed stress comparison; not an acceptance tolerance", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 2, section: "Seats Static Strength Analysis Model", requirementId: "BACKREST-GEOMETRY-001", category: "GEOMETRY", value: "Exact dimensions and CAD geometry not supplied", unit: "N/A", applicability: "Prevents exact reproduction", confidence: "HIGH", classification: "NOT_AVAILABLE" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 2, section: "Seats Static Strength Analysis Model", requirementId: "BACKREST-MATERIAL-001", category: "MATERIAL_PROPERTIES", value: "Material grade, constitutive data, and yield limit not supplied", unit: "N/A", applicability: "Prevents current-model stress comparison", confidence: "HIGH", classification: "NOT_AVAILABLE" },
    { sourceDocument: "CarSeatBackrestStaticStrengthExperimentandSimulation.pdf", page: 2, section: "Seat Backrest Static Strength Experiment", requirementId: "BACKREST-FIXTURE-001", category: "FIXTURE_CONFIGURATION", value: "Fixture coordinates and constraints not supplied", unit: "N/A", applicability: "Prevents exact reproduction", confidence: "HIGH", classification: "NOT_AVAILABLE" },
  ];
  return { id: "BACKREST-STATIC-2009", title: "Car Seat Backrest Static Strength Experiment and Simulation", analysisType: "STATIC_BACKREST", inputs, sourceHash: canonicalHash(inputs) };
})();

export const INTEGRATED_BELT_STUDY: ReferenceStudy = (() => {
  const inputs: ReferenceStudyInput[] = [
    { sourceDocument: "Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf", page: 2, section: "Abstract", requirementId: "BELT-ANALYSIS-001", category: "EXPERIMENTAL_CONDITIONS", value: "Full-scale sled experiments with simplified seats and integrated 3-point belts", unit: "N/A", applicability: "Dynamic crash-sled study", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf", page: 2, section: "Abstract", requirementId: "BELT-OCCUPANT-001", category: "EXPERIMENTAL_CONDITIONS", value: "50th percentile Hybrid III dummy", unit: "N/A", applicability: "Dynamic occupant model required", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf", page: 3, section: "Method", figureOrTable: "Figure 1", requirementId: "BELT-FIXTURE-001", category: "FIXTURE_CONFIGURATION", value: "Rigid sled; support plate; dummy feet fastened to plate", unit: "N/A", applicability: "Dynamic sled boundary system", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf", page: 3, section: "Method", requirementId: "BELT-SLED-MASS-001", category: "EXPERIMENTAL_CONDITIONS", value: "Approximately 2115", unit: "kg", applicability: "Complete published sled, seat, dummy and instrumentation", confidence: "HIGH", classification: "EXPLICITLY_DOCUMENTED" },
    { sourceDocument: "Evaluationoffiniteelementmodelsofseatstructureswithintegratedsafety.pdf", page: 2, section: "Abstract", requirementId: "BELT-DYNAMIC-MODEL-001", category: "FE_MODEL_INFORMATION", value: "Complete belt, dummy, dynamic material and contact model details required for reproduction", unit: "N/A", applicability: "Current static CalculiX route does not support this study", confidence: "HIGH", classification: "NOT_AVAILABLE" },
  ];
  return { id: "INTEGRATED-BELT-2010", title: "Evaluation of finite element models of seat structures with integrated safety belts using full-scale experiments", analysisType: "DYNAMIC_INTEGRATED_BELT", inputs, sourceHash: canonicalHash(inputs) };
})();

export function assessStudyReproducibility(study: ReferenceStudy): ReferenceReproducibilityAssessment {
  const requiredInputs = study.inputs.filter((input) => input.classification === "NOT_AVAILABLE").map((input) => input.requirementId);
  if (study.analysisType !== "STATIC_BACKREST") requiredInputs.push("STATIC_CALCULIX_ANALYSIS_NOT_APPLICABLE_TO_DYNAMIC_SLED_STUDY");
  return { status: requiredInputs.length ? "REFERENCE_NOT_REPRODUCIBLE" : "REFERENCE_REPRODUCED", requiredInputs, evidenceHash: canonicalHash({ id: study.id, sourceHash: study.sourceHash, requiredInputs }) };
}

export function comparePublishedReference(result: PublishedReferenceResult, simulationValue?: number): ReferenceSimulationComparison {
  if (!Number.isFinite(simulationValue)) return { status: "REQUIRED_INPUT", reason: "SIMULATION_RESULT" };
  const absoluteError = Math.abs((simulationValue as number) - result.value);
  const relativeError = absoluteError / Math.max(Math.abs(result.value), Number.EPSILON);
  if (result.toleranceKind !== "ACCEPTANCE" || !Number.isFinite(result.documentedTolerance)) return { status: "COMPARISON_ONLY", absoluteError, relativeError, reason: "NO_DOCUMENTED_ACCEPTANCE_TOLERANCE" };
  return { status: relativeError <= (result.documentedTolerance as number) ? "CORRELATED" : "NOT_CORRELATED", absoluteError, relativeError };
}
