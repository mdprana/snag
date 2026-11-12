import { describe, it, expect } from "vitest";
import { assertSameOrigin } from "@/src/lib/origin";

const req = (origin?: string) =>
  new Request("https://localhost:3100/api/claims", { method: "POST", headers: origin ? { Origin: origin } : {} });

describe("C4 origin check", () => {
  it("evil origin returns 403", () => {
    expect(assertSameOrigin(req("https://evil.example"))?.status).toBe(403);
  });
  it("missing origin returns 403", () => {
    expect(assertSameOrigin(req())?.status).toBe(403);
    expect(assertSameOrigin(req("null"))?.status).toBe(403);
  });
  it("same origin passes", () => {
    expect(assertSameOrigin(req("https://localhost:3100"))).toBeNull();
  });
});
