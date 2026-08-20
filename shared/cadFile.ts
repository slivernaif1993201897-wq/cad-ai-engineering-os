import type { EngineeringTruthStatus } from "./engineeringTruth";

export const CAD_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const CAD_FILE_SUPPORTED_EXTENSIONS = ["step", "stp", "stl"] as const;

export type CADFileFormat = "STEP" | "STL" | "UNSUPPORTED";
export type CADFileParserStatus = "UPLOADED" | "VALIDATING" | "PARSED" | "PARTIALLY_PARSED" | "PARSE_FAILED" | "UNSUPPORTED" | "CORRUPTED" | "REMOVED";
export type CADFileProvenance = "PARSED" | "CALCULATED" | "INFERRED" | "ASSUMED" | "UNKNOWN";
export type CADFileUnitsStatus = "KNOWN" | "UNKNOWN" | "ASSUMED";

export interface CADFileProperty<T> {
  value?: T;
  provenance: CADFileProvenance;
  note?: string;
}

export interface CADFileBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  diagonal: number;
  provenance: CADFileProvenance;
}

export interface StepGeometryStatistics {
  solids: CADFileProperty<number>;
  shells: CADFileProperty<number>;
  faces: CADFileProperty<number>;
  edges: CADFileProperty<number>;
  vertices: CADFileProperty<number>;
  transferRoots: CADFileProperty<number>;
}

export interface StlGeometryStatistics {
  triangles: CADFileProperty<number>;
  surfaceArea: CADFileProperty<number>;
  signedVolume: CADFileProperty<number>;
  watertight: CADFileProperty<boolean>;
  normals: CADFileProperty<"PRESENT" | "UNAVAILABLE">;
}

export interface CADFileContext {
  fileId: string;
  projectId: string;
  conversationId?: string;
  fileName: string;
  format: CADFileFormat;
  fileSizeBytes: number;
  sha256: string;
  version: number;
  parentFileId?: string;
  parser: "OpenCascade.js" | "Native STL Scanner" | "NONE";
  parserVersion: string;
  parseStatus: CADFileParserStatus;
  validationStatus: "VALID" | "INVALID" | "UNKNOWN";
  units: CADFileProperty<string> & { status: CADFileUnitsStatus };
  boundingBox?: CADFileBoundingBox;
  step?: StepGeometryStatistics;
  stl?: StlGeometryStatistics;
  storage: { key: string; url: string };
  limitations: string[];
  parserError?: { reason: string; supportedOperation: string; recommendedAction: string };
  createdAt: string;
}

export interface CADFileUploadInput {
  projectId: string;
  accessKey: string;
  conversationId?: string;
  fileName: string;
  mimeType?: string;
  base64: string;
}

export interface CADFileUploadResult {
  file: CADFileContext;
  duplicateOfFileId?: string;
  recordedToConversation: boolean;
}

export interface CADFileAnalysisContext {
  file: CADFileContext;
  facts: string[];
  inferences: string[];
  unknowns: string[];
  requiresCAE: string[];
  requiresPhysicalTesting: string[];
}
