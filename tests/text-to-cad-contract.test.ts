import { describe, expect, it } from "vitest";

import { textToCadInputSchema, textToCadOutputSchema } from "../server/textToCad";

describe("Text-to-CAD contract", () => {
  it("accepts a bounded engineering brief", () => {
    const result = textToCadInputSchema.safeParse({
      prompt: "Create a 100 mm mounting block with four corner holes.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty or oversized input", () => {
    expect(textToCadInputSchema.safeParse({ prompt: "short" }).success).toBe(false);
    expect(textToCadInputSchema.safeParse({ prompt: "x".repeat(2001) }).success).toBe(false);
  });

  it("requires a reviewable, fail-closed readiness enum", () => {
    const schema = textToCadOutputSchema.schema as { properties: { readiness: { enum: readonly string[] } } };
    expect(schema.properties.readiness.enum).toEqual([
      "REVIEW_ONLY",
      "READY_FOR_PINNED_RUNTIME",
      "BLOCKED",
    ]);
  });
});
