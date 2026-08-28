import { describe, expect, it } from "vitest";
import { exportValidatedStep } from "../server/cadKernel";

type Fault = "writer" | "transfer" | "write" | "read" | "empty" | "malformed" | "invalid";

function fakeOc(fault?: Fault) {
  const state = { unlinked: 0, writerDeleted: 0, analyzerDeleted: 0 };
  class Analyzer { IsValid_2() { return fault !== "invalid"; } delete() { state.analyzerDeleted += 1; } }
  class Writer {
    constructor() { if (fault === "writer") throw new Error("writer failure"); }
    Transfer() { return fault === "transfer" ? false : true; }
    Write() { return fault === "write" ? false : true; }
    delete() { state.writerDeleted += 1; }
  }
  return {
    state,
    oc: {
      BRepCheck_Analyzer: Analyzer,
      STEPControl_Writer_1: Writer,
      STEPControl_StepModelType: { STEPControl_AsIs: 0 },
      FS: {
        readFile: () => {
          if (fault === "read") throw new Error("missing file");
          if (fault === "empty") return new Uint8Array();
          if (fault === "malformed") return Buffer.from("not step");
          return Buffer.from("ISO-10303-21;\nEND-ISO-10303-21;");
        },
        unlink: () => { state.unlinked += 1; },
      },
    },
  };
}

describe("exportValidatedStep failure mutations", () => {
  it("rejects a null shape before writer construction", () => {
    const { oc } = fakeOc();
    expect(() => exportValidatedStep(oc, null, {}, "test")).toThrow("non-null");
  });

  for (const fault of ["invalid", "writer", "transfer", "write", "read", "empty", "malformed"] as const) {
    it(`fails closed and cleans temporary resources on ${fault}`, () => {
      const { oc, state } = fakeOc(fault);
      expect(() => exportValidatedStep(oc, { IsNull: () => false }, {}, "test")).toThrow("INVALID_GEOMETRY_EXPORT");
      expect(state.unlinked).toBe(1);
      expect(state.analyzerDeleted).toBe(1);
      if (fault !== "writer" && fault !== "invalid") expect(state.writerDeleted).toBe(1);
    });
  }

  it("returns validated exact STEP bytes only after successful export", () => {
    const { oc, state } = fakeOc();
    const bytes = exportValidatedStep(oc, { IsNull: () => false }, {}, "test");
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(bytes.toString("utf8")).toContain("ISO-10303-21");
    expect(state.unlinked).toBe(1);
    expect(state.writerDeleted).toBe(1);
    expect(state.analyzerDeleted).toBe(1);
  });
});
