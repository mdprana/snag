import { describe, it, expect } from "vitest";
import { hit } from "@/src/lib/ratelimit";
import { testDb } from "../helpers/db";

describe("C8 rate limit", () => {
  it("11th hit in window returns ok false with retryAfter", async () => {
    const c = await testDb();
    const t0 = 1_800_000_000_000;
    for (let i = 0; i < 10; i++) expect((await hit(c, "auth:ip", 10, 60, t0 + i)).ok).toBe(true);
    const r = await hit(c, "auth:ip", 10, 60, t0 + 20_000);
    expect(r.ok).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
    expect((await hit(c, "other:ip", 10, 60, t0)).ok).toBe(true);
    expect((await hit(c, "auth:ip", 10, 60, t0 + 60_000)).ok).toBe(true);
  });

  it("purges windows older than 1 h", async () => {
    const c = await testDb();
    const t0 = 1_800_000_000_000;
    await hit(c, "k", 10, 60, t0);
    await hit(c, "k", 10, 60, t0 + 3_700_000);
    const { rows } = await c.execute("SELECT count(*) AS n FROM rate_limits");
    expect(rows[0].n).toBe(1);
  });
});
