import { describe, expect, it } from "vitest";

import { normalizeEngineeringApiBaseUrl } from "../lib/engineering-api-url";

describe("engineering API connection boundary", () => {
  it("accepts only normalized HTTP(S) API base URLs", () => {
    expect(normalizeEngineeringApiBaseUrl(" https://engineering.example.com/ ")).toBe("https://engineering.example.com");
    expect(normalizeEngineeringApiBaseUrl("http://127.0.0.1:3000/")).toBe("http://127.0.0.1:3000");
    expect(normalizeEngineeringApiBaseUrl("ftp://engineering.example.com")).toBeNull();
    expect(normalizeEngineeringApiBaseUrl("not-a-url")).toBeNull();
  });
});
