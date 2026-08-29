import { describe, expect, it } from "vitest";
import { generateBackrestConceptCad } from "../server/seatConceptCadEngine";
import { createConceptDesign, createConceptDesignSuccessor, getConceptDesign, setConceptDesignParameter } from "../server/seatDesignAuthoring";
import { openPersistentProject } from "../server/persistentMemory";

describe("user concept design authoring", () => {
  it("persists explicit required parameters, creates an immutable successor revision, and preserves project isolation", async () => {
    const project = await openPersistentProject({ name: "Concept authoring regression" });
    const access = { projectId: project.id, accessKey: project.accessKey };
    const created = await createConceptDesign({ ...access, templateId: "CONCEPT_BACKREST_LOAD_PATH", name: "User backrest concept", description: "User-owned editable concept" });
    let model = await getConceptDesign({ ...access, seatDesignId: created.seat.id, revisionId: created.revisionId });
    expect(model.cadReadiness).toBe("REQUIRED_INPUT");
    expect(model.parameters.filter((parameter) => parameter.cadRequired && parameter.state === "REQUIRED_INPUT")).toHaveLength(3);
    await setConceptDesignParameter({ ...access, seatDesignId: created.seat.id, revisionId: created.revisionId, parameterName: "BACKREST_WIDTH", value: "420", unit: "mm" });
    await setConceptDesignParameter({ ...access, seatDesignId: created.seat.id, revisionId: created.revisionId, parameterName: "BACKREST_HEIGHT", value: "560", unit: "mm" });
    await setConceptDesignParameter({ ...access, seatDesignId: created.seat.id, revisionId: created.revisionId, parameterName: "PLATE_THICKNESS", value: "3", unit: "mm" });
    model = await getConceptDesign({ ...access, seatDesignId: created.seat.id, revisionId: created.revisionId });
    expect(model.cadReadiness).toBe("CAD_READY");
    const successor = await createConceptDesignSuccessor({ ...access, seatDesignId: created.seat.id, revisionId: created.revisionId });
    const inherited = await getConceptDesign({ ...access, seatDesignId: created.seat.id, revisionId: successor.revisionId });
    expect(inherited.parameters.find((parameter) => parameter.name === "BACKREST_WIDTH")?.value).toBe("420");
    const foreign = await openPersistentProject({ name: "Concept authoring foreign project" });
    await expect(getConceptDesign({ projectId: foreign.id, accessKey: foreign.accessKey, seatDesignId: created.seat.id, revisionId: created.revisionId })).rejects.toThrow();
  }, 20_000);

  it("generates deterministic real OpenCascade concept geometry only from supplied positive dimensions", async () => {
    await expect(generateBackrestConceptCad({ seatRevisionId: "revision-gate", widthMm: Number.NaN, heightMm: 560, thicknessMm: 3 })).rejects.toThrow("CONCEPT_CAD_DIMENSIONS_REQUIRED_POSITIVE_MM");
    const artifact = await generateBackrestConceptCad({ seatRevisionId: "revision-valid", widthMm: 420, heightMm: 560, thicknessMm: 3 });
    expect(artifact.kernel).toBe("OpenCascade.js");
    expect(artifact.stepByteLength).toBeGreaterThan(100);
    expect(artifact.artifactHash).toHaveLength(64);
    expect(artifact.geometryStatus).toBe("PARTIAL_CAD");
    expect(artifact.undefinedFeatures).toContain("MOUNTING_ARCHITECTURE");
  }, 20_000);
});
