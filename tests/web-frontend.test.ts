import { describe, expect, it } from "vitest";

import { canServeWebFallback, productionWebRoot } from "../server/webFrontend";

describe("production Expo Web frontend fallback", () => {
  it("uses only the packaged client output and preserves API and storage paths", () => {
    expect(productionWebRoot("/workspace")).toBe("/workspace/dist/client");
    expect(canServeWebFallback({ method: "GET", path: "/", headers: {} } as never)).toBe(true);
    expect(canServeWebFallback({ method: "GET", path: "/seats", headers: { accept: "text/html" } } as never)).toBe(true);
    expect(canServeWebFallback({ method: "GET", path: "/api/health", headers: { accept: "text/html" } } as never)).toBe(false);
    expect(canServeWebFallback({ method: "GET", path: "/manus-storage/file", headers: { accept: "text/html" } } as never)).toBe(false);
    expect(canServeWebFallback({ method: "POST", path: "/seats", headers: { accept: "text/html" } } as never)).toBe(false);
  });
});
