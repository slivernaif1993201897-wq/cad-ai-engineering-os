import { invokeLLM } from "./_core/llm";
import { z } from "zod";

export const textToCadInputSchema = z.object({ prompt: z.string().trim().min(12).max(2000) });

export const textToCadOutputSchema = {
  name: "cad_agent_plan",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      summary: { type: "string" },
      assumptions: { type: "array", items: { type: "string" } },
      features: { type: "array", items: { type: "string" } },
      constraints: { type: "array", items: { type: "string" } },
      readiness: { type: "string", enum: ["REVIEW_ONLY", "READY_FOR_PINNED_RUNTIME", "BLOCKED"] },
    },
    required: ["summary", "assumptions", "features", "constraints", "readiness"],
  },
} as const;

export async function planTextToCad(prompt: string) {
  const response = await invokeLLM({
    model: "gpt-5-mini",
    maxTokens: 900,
    messages: [
      {
        role: "system",
        content: "You are the Text-to-CAD helper inside CAD-AGENT, not an autonomous build agent. Convert a natural-language CAD request into a concise reviewable specification for the CAD-AGENT application. Never output Python, shell, executable paths, URLs, or claims that a STEP artifact was generated. CAD-AGENT owns build execution, pinned-runtime gates, managed ingestion, and artifact governance. Treat missing pinned runtime evidence as BLOCKED. Return JSON only.",
      },
      { role: "user", content: prompt },
    ],
    responseFormat: { type: "json_schema", json_schema: textToCadOutputSchema },
  });

  const content = response.choices[0]?.message.content;
  if (typeof content !== "string") throw new Error("Manus returned no structured CAD plan");
  return JSON.parse(content) as {
    summary: string;
    assumptions: string[];
    features: string[];
    constraints: string[];
    readiness: "REVIEW_ONLY" | "READY_FOR_PINNED_RUNTIME" | "BLOCKED";
  };
}
