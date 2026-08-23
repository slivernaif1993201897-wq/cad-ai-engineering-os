import { describe, expect, it } from "vitest";

import { admitReferenceBenchmark, SEAT_REFERENCE_DATASET, verifySeatReferenceDataset } from "../server/seatReferenceDataset";

describe("Seat Reference Dataset", () => {
  it("hash-binds source-traceable records from every extracted study", () => {
    expect(SEAT_REFERENCE_DATASET.studies).toHaveLength(7);
    expect(verifySeatReferenceDataset(SEAT_REFERENCE_DATASET)).toBe(true);
  });

  it("does not mix incomplete studies into a runnable static benchmark", () => {
    const staticBackrest = admitReferenceBenchmark(SEAT_REFERENCE_DATASET, "BACKREST-STATIC-2009");
    expect(staticBackrest.status).toBe("REQUIRES_ENGINEERING_REVIEW");
    expect(staticBackrest.requiredInputs).toContain("SOURCE_GEOMETRY_DIMENSIONS");
    const sustainability = admitReferenceBenchmark(SEAT_REFERENCE_DATASET, "DESIGNING-SUSTAINABILITY");
    expect(sustainability.status).toBe("REQUIRES_ENGINEERING_REVIEW");
    expect(sustainability.requiredInputs).toContain("DETAILED_GEOMETRY");
  });

  it("rejects dynamic and non-CAE documents from the static CalculiX path", () => {
    expect(admitReferenceBenchmark(SEAT_REFERENCE_DATASET, "INTEGRATED-BELT-2010").status).toBe("NOT_APPLICABLE");
    expect(admitReferenceBenchmark(SEAT_REFERENCE_DATASET, "UNECE-IWVTA-AMENDMENT").status).toBe("NOT_APPLICABLE");
  });

  it("rejects a tampered source dataset", () => {
    const tampered = structuredClone(SEAT_REFERENCE_DATASET);
    tampered.studies[0].items[0].value = "999";
    expect(verifySeatReferenceDataset(tampered)).toBe(false);
    expect(admitReferenceBenchmark(tampered, "DOT-FMVSS-207").reason).toBe("DATASET_HASH_MISMATCH");
  });
});
