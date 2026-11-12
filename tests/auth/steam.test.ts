import { describe, expect, it } from "vitest";
import { steamLoginUrl, verifySteamCallback } from "@/src/auth/steam";
import { testDb } from "../helpers/db";

const appUrl = "https://localhost:3100";
const endpoint = "https://steamcommunity.com/openid/login";

function params(overrides: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    "openid.mode": "id_res",
    "openid.op_endpoint": endpoint,
    "openid.return_to": `${appUrl}/api/auth/steam/callback?n=flow-1`,
    "openid.response_nonce": "2026-11-12T00:00:00Zunique",
    "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198000000000",
    "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000",
    ...overrides,
  });
}

describe("Steam OpenID", () => {
  it("builds exact login URL", () => {
    const url = new URL(steamLoginUrl(appUrl, "flow-1"));
    expect(url.origin + url.pathname).toBe(endpoint);
    expect(url.searchParams.get("openid.return_to")).toBe(`${appUrl}/api/auth/steam/callback?n=flow-1`);
    expect(url.searchParams.get("openid.realm")).toBe(appUrl);
  });

  it.each([
    ["wrong endpoint", { "openid.op_endpoint": "https://evil.example/openid/login" }],
    ["other origin", { "openid.return_to": "https://evil.example/api/auth/steam/callback?n=flow-1" }],
    ["short claimed id", { "openid.claimed_id": "https://steamcommunity.com/openid/id/123" }],
    ["evil claimed id", { "openid.claimed_id": "https://evil.com/openid/id/76561198000000000" }],
  ])("rejects %s", async (_, override) => {
    const db = await testDb();
    await db.execute({ sql: "INSERT INTO auth_flows(id, provider, expires_at) VALUES(?, 'steam', ?)", args: ["flow-1", Date.now() + 600000] });
    const result = await verifySteamCallback(params(override), { appUrl, flowId: "flow-1", db, fetchFn: async () => new Response("is_valid:true") });
    expect(result).toEqual({ error: "invalid_callback" });
  });

  it("rejects missing flow and invalid Steam assertion", async () => {
    const db = await testDb();
    const missing = await verifySteamCallback(params(), { appUrl, flowId: "missing", db, fetchFn: async () => new Response("is_valid:true") });
    expect(missing).toEqual({ error: "invalid_flow" });
    await db.execute({ sql: "INSERT INTO auth_flows(id, provider, expires_at) VALUES(?, 'steam', ?)", args: ["flow-1", Date.now() + 600000] });
    const invalid = await verifySteamCallback(params(), { appUrl, flowId: "flow-1", db, fetchFn: async () => new Response("is_valid:false") });
    expect(invalid).toEqual({ error: "invalid_assertion" });
  });

  it("rejects reused nonce and accepts valid callback once", async () => {
    const db = await testDb();
    await db.execute({ sql: "INSERT INTO auth_flows(id, provider, expires_at) VALUES(?, 'steam', ?)", args: ["flow-1", Date.now() + 600000] });
    const fetchFn = async () => new Response("is_valid:true");
    expect(await verifySteamCallback(params(), { appUrl, flowId: "flow-1", db, fetchFn })).toEqual({ steamId: "76561198000000000" });
    expect(await verifySteamCallback(params(), { appUrl, flowId: "flow-1", db, fetchFn })).toEqual({ error: "invalid_flow" });
  });
});
