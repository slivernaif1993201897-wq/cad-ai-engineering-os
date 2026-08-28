export const CAPABILITY_STATUSES = ["VERIFIED", "PARTIAL", "BLOCKED", "UNSUPPORTED"] as const;
export type CapabilityStatus = (typeof CAPABILITY_STATUSES)[number];
export type CapabilityDomain = "CAD" | "CAE" | "CAM" | "AI" | "ASSEMBLY" | "INTEROPERABILITY" | "DATA" | "VALIDATION";

export interface EngineeringCapability {
  capabilityId: string;
  domain: CapabilityDomain;
  name: string;
  description: string;
  engine: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  requiredParameters: string[];
  supportedFormats: string[];
  validationRequirements: string[];
  securityRequirements: string[];
  artifactType: string[];
  status: CapabilityStatus;
  version: string;
  testReference: string[];
  knownLimitations: string[];
}

export interface CapabilityRegistrySnapshot {
  registryId: "CAD-AGENT.CAPABILITY.REGISTRY";
  registryVersion: string;
  registryHash: string;
  capabilities: EngineeringCapability[];
  persistedRecordId?: string;
}
