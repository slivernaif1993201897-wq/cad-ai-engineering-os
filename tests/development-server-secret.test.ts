import { describe, expect, it } from "vitest";

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
const httpKey = process.env.CAD_AGENT_HTTP_KEY;

describe("development server runtime secret", () => {
  it("uses the configured HTTP key for a lightweight health request", async () => {
    expect(baseUrl).toBe("https://cadaiengine-m5yd8vuw.manus.space");
    expect(httpKey, "CAD_AGENT_HTTP_KEY must be supplied through the runtime secret channel").toBeTruthy();

    const response = await fetch(`${baseUrl}/api/health`, {
      headers: { Authorization: `Bearer ${httpKey}` },
    });
    expect(response.ok, `Development server health rejected the configured HTTP key: ${response.status}`).toBe(true);
    const body = (await response.json()) as { ok?: boolean };
    expect(body.ok).toBe(true);
  }, 20_000);
});
