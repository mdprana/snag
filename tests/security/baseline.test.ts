import { describe, it, expect, vi, afterEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseEnv } from "@/src/lib/env";
import { log } from "@/src/lib/log";
import { buildCsp, securityHeaders } from "@/src/lib/headers";

const base = {
  APP_URL: "https://snag.example.com",
  DATABASE_URL: "file:test.db",
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "fake-public",
  VAPID_PRIVATE_KEY: "fake-private",
  VAPID_SUBJECT: "mailto:owner@example.com",
  CRON_SECRET: "fake-cron-secret-0123456789abcdef",
  ASF_REPORT_SECRET: "fake-asf-secret-0123456789abcdef",
  OWNER_STEAMID64: "76561198000000000",
};

afterEach(() => vi.restoreAllMocks());

describe("security baseline", () => {
  it("parseEnv rejects http APP_URL", () => {
    expect(() => parseEnv({ ...base, APP_URL: "http://snag.example.com" })).toThrow();
    expect(() => parseEnv({ ...base, APP_URL: "http://localhost:3100" })).toThrow();
    expect(parseEnv({ ...base, APP_URL: "https://localhost:3100" }).APP_URL).toBe("https://localhost:3100");
    expect(parseEnv(base).APP_URL).toBe("https://snag.example.com");
  });

  it("parseEnv requires EPIC secrets only when EPIC_LOGIN_ENABLED is true", () => {
    expect(() => parseEnv(base)).not.toThrow();
    expect(() => parseEnv({ ...base, EPIC_LOGIN_ENABLED: "false" })).not.toThrow();
    expect(() => parseEnv({ ...base, EPIC_LOGIN_ENABLED: "true" })).toThrow();
    expect(() => parseEnv({ ...base, EPIC_LOGIN_ENABLED: "true", EPIC_CLIENT_ID: "id" })).toThrow();
    expect(() =>
      parseEnv({ ...base, EPIC_LOGIN_ENABLED: "true", EPIC_CLIENT_ID: "id", EPIC_CLIENT_SECRET: "fake" }),
    ).not.toThrow();
  });

  it("log redacts sensitive keys", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    log("info", "login", {
      authorization: "x-auth-value",
      endpoint: "y-endpoint-value",
      steamId: "76561198000000001",
      nested: { cookie: "c-value", list: [{ access_token: "tok-value" }], ok: "keep-me" },
    });
    const out = spy.mock.calls.map((c) => c.join(" ")).join("\n");
    for (const v of ["x-auth-value", "y-endpoint-value", "76561198000000001", "c-value", "tok-value"]) {
      expect(out).not.toContain(v);
    }
    expect(out).toContain("keep-me");
    expect(JSON.parse(out)).toMatchObject({ level: "info", msg: "login" });
  });

  it("csp has nonce, strict-dynamic, frame-ancestors none, no unsafe-inline in script-src", () => {
    const csp = buildCsp("abc123", false);
    const script = csp.split(";").map((d) => d.trim()).find((d) => d.startsWith("script-src"))!;
    expect(script).toContain("'nonce-abc123'");
    expect(script).toContain("'strict-dynamic'");
    expect(script).not.toContain("unsafe-inline");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it("csp allows media only from self and the exact Steam trailer host", () => {
    const directives = buildCsp("n", false).split("; ");
    expect(directives.filter((d) => d.startsWith("media-src"))).toEqual(["media-src 'self' https://video.akamai.steamstatic.com"]);
    expect(directives).toContain("connect-src 'self'");
    expect(buildCsp("n", false)).not.toMatch(/\*|blob:|unsafe-inline/);
  });

  it("csp adds unsafe-eval only in dev", () => {
    expect(buildCsp("n", false)).not.toContain("unsafe-eval");
    expect(buildCsp("n", true)).toContain("'unsafe-eval'");
  });

  it("security headers include HSTS, nosniff, referrer and permissions policy", () => {
    const h = securityHeaders();
    expect(h["Strict-Transport-Security"]).toBe("max-age=63072000; includeSubDomains; preload");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toBe("camera=(), microphone=(), geolocation=(), payment=()");
  });

  it("no dangerouslySetInnerHTML in app or src", () => {
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((f) => {
        const p = join(d, f);
        return statSync(p).isDirectory() ? walk(p) : /\.(t|j)sx?$/.test(p) ? [p] : [];
      });
    const hits = ["app", "src"].flatMap(walk).filter((f) => readFileSync(f, "utf8").includes("dangerouslySetInnerHTML"));
    expect(hits).toEqual([]);
  });
});
