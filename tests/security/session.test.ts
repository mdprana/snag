import { describe, it, expect } from "vitest";
import { createSession, getSession, destroySession, SESSION_COOKIE } from "@/src/lib/session";
import { randomToken, sha256, safeEqual } from "@/src/lib/crypto";
import { testDb } from "../helpers/db";

async function withUser() {
  const c = await testDb();
  await c.execute("INSERT INTO users(id, created_at) VALUES('u1', 1)");
  return c;
}
const header = (sid: string) => `other=1; ${SESSION_COOKIE}=${sid}`;

describe("crypto", () => {
  it("randomToken is 32-byte base64url, sha256 hex, safeEqual handles length mismatch", () => {
    expect(randomToken()).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(randomToken());
    expect(sha256("a")).toBe("ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb");
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});

describe("C3 sessions", () => {
  it("cookie has __Host- name, HttpOnly, Secure, SameSite=Lax, Path=/, Max-Age 30 days", async () => {
    const { sid, cookie } = await createSession(await withUser(), "u1");
    expect(cookie.startsWith(`__Host-snag_sid=${sid};`)).toBe(true);
    for (const a of ["HttpOnly", "Secure", "SameSite=Lax", "Path=/", "Max-Age=2592000"]) expect(cookie).toContain(a);
    expect(cookie).not.toContain("Domain");
  });

  it("DB holds hash not raw sid", async () => {
    const c = await withUser();
    const { sid } = await createSession(c, "u1");
    const { rows } = await c.execute("SELECT id_hash FROM sessions");
    expect(rows.map((r) => r.id_hash)).toEqual([sha256(sid)]);
    expect(await getSession(c, header(sid))).toEqual({ userId: "u1" });
  });

  it("login rotates sid", async () => {
    const c = await withUser();
    const old = await createSession(c, "u1");
    const next = await createSession(c, "u1", old.sid);
    expect(next.sid).not.toBe(old.sid);
    expect(await getSession(c, header(old.sid))).toBeNull();
    expect(await getSession(c, header(next.sid))).toEqual({ userId: "u1" });
  });

  it("logout makes old sid invalid", async () => {
    const c = await withUser();
    const { sid } = await createSession(c, "u1");
    await destroySession(c, sid);
    expect(await getSession(c, header(sid))).toBeNull();
  });

  it("sid older than 30 days is rejected", async () => {
    const c = await withUser();
    const { sid } = await createSession(c, "u1");
    await c.execute({ sql: "UPDATE sessions SET expires_at = ?", args: [Date.now() - 1] });
    expect(await getSession(c, header(sid))).toBeNull();
  });

  it("missing or unknown cookie returns null", async () => {
    const c = await withUser();
    expect(await getSession(c, null)).toBeNull();
    expect(await getSession(c, "")).toBeNull();
    expect(await getSession(c, header("nope"))).toBeNull();
  });
});
