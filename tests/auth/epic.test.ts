import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { createHash } from "node:crypto";
import { epicAuthorizeUrl, exchangeEpicCode } from "@/src/auth/epic";
import { GET as start } from "@/app/api/auth/epic/route";
import { GET as callback } from "@/app/api/auth/epic/callback/route";
import { env } from "@/src/lib/env";
import { createSession, getSession } from "@/src/lib/session";
import { testDb } from "../helpers/db";

const database = vi.hoisted(() => ({ current: null as Client | null }));
vi.mock("@/src/lib/db", async (importOriginal) => ({ ...await importOriginal<typeof import("@/src/lib/db")>(), db: () => database.current! }));
const appUrl = "https://localhost:3100";
const base = "https://api.epicgames.dev/epic/oauth/v2";
const accountId = "0123456789abcdef0123456789abcdef";
const credentials = { clientId: "fake-client", clientSecret: "fake-secret", appUrl };
const tokens = { account_id: accountId, access_token: "fake-access", refresh_token: "fake-refresh" };

function provider() {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(init?.redirect).toBe("error");
    if (String(input) === `${base}/token`) return Response.json(tokens);
    if (String(input) === `${base}/userInfo`) return Response.json({ preferred_username: "Epic name" });
    if (String(input) === `${base}/revoke`) return new Response(null, { status: 204 });
    throw new Error("Unexpected network request");
  });
}

async function flow() {
  const response = await start(new Request(`${appUrl}/api/auth/epic`));
  const url = new URL(response.headers.get("location")!);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  return { response, url, cookie, state: url.searchParams.get("state")! };
}

function request(state: string, cookie?: string, extra = "code=fake-code") {
  return new Request(`${appUrl}/api/auth/epic/callback?state=${state}&${extra}`, { headers: cookie ? { cookie } : {} });
}

describe("Epic OAuth", () => {
  let db: Client;
  beforeEach(async () => {
    db = await testDb();
    database.current = db;
    env.EPIC_LOGIN_ENABLED = "true";
    env.EPIC_CLIENT_ID = credentials.clientId;
    env.EPIC_CLIENT_SECRET = credentials.clientSecret;
    vi.stubGlobal("fetch", provider());
  });
  afterEach(() => {
    db.close();
    delete env.EPIC_LOGIN_ENABLED;
    delete env.EPIC_CLIENT_ID;
    delete env.EPIC_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it("authorize URL has exact redirect_uri, scope=basic_profile only, state, code_challenge_method=S256", () => {
    const url = new URL(epicAuthorizeUrl({ clientId: credentials.clientId, appUrl, state: "state", codeChallenge: "challenge" }));
    expect(url.origin + url.pathname).toBe("https://www.epicgames.com/id/authorize");
    expect(Object.fromEntries(url.searchParams)).toEqual({ client_id: credentials.clientId, redirect_uri: `${appUrl}/api/auth/epic/callback`, response_type: "code", scope: "basic_profile", state: "state", code_challenge: "challenge", code_challenge_method: "S256" });
  });

  it("start stores random state and verifier with S256 PKCE and secure ten-minute cookie", async () => {
    const first = await flow();
    const second = await flow();
    expect(first.state).not.toBe(second.state);
    const row = (await db.execute("SELECT * FROM auth_flows ORDER BY rowid LIMIT 1")).rows[0];
    expect(row.provider).toBe("epic");
    expect(row.state).toBe(first.state);
    expect(first.state).toMatch(/^[\w-]{43}$/);
    expect(row.code_verifier).toMatch(/^[\w-]{43}$/);
    expect(first.url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(String(row.code_verifier)).digest("base64url"));
    expect(Number(row.expires_at) - Date.now()).toBeGreaterThan(590000);
    expect(Number(row.expires_at) - Date.now()).toBeLessThanOrEqual(600000);
    for (const attribute of ["__Host-snag_flow=", "HttpOnly", "Secure", "SameSite=lax", "Path=/", "Max-Age=600"]) expect(first.response.headers.get("set-cookie")).toContain(attribute);
  });

  it.each(["missing", "mismatched", "missing cookie", "expired", "wrong provider", "wrong row state"])("callback rejects %s state", async (kind) => {
    const { state, cookie } = await flow();
    if (kind === "expired") await db.execute("UPDATE auth_flows SET expires_at = 0");
    if (kind === "wrong provider") await db.execute("UPDATE auth_flows SET provider = 'steam'");
    if (kind === "wrong row state") await db.execute("UPDATE auth_flows SET state = 'other'");
    const response = await callback(request(kind === "missing" ? "" : kind === "mismatched" ? "other" : state, kind === "missing cookie" ? undefined : cookie));
    expect(response.headers.get("location")).toBe(`${appUrl}/login?e=epic`);
    expect(fetch).not.toHaveBeenCalled();
    expect((await db.execute("SELECT * FROM sessions")).rows).toHaveLength(0);
  });

  it("callback rejects reused state, including concurrent replay", async () => {
    const { state, cookie } = await flow();
    const responses = await Promise.all([callback(request(state, cookie)), callback(request(state, cookie))]);
    expect(responses.map((r) => r.headers.get("location")).sort()).toEqual([`${appUrl}/feed`, `${appUrl}/login?e=epic`]);
    expect((await callback(request(state, cookie))).headers.get("location")).toBe(`${appUrl}/login?e=epic`);
    expect((await db.execute("SELECT * FROM auth_flows")).rows).toHaveLength(0);
  });

  it("token request uses Basic auth and same redirect_uri", async () => {
    const fetchFn = provider();
    expect(await exchangeEpicCode({ ...credentials, code: "fake-code", verifier: "fake-verifier" }, fetchFn)).toEqual({ accountId, displayName: "Epic name" });
    const init = fetchFn.mock.calls[0][1] as RequestInit;
    expect(new Headers(init.headers).get("authorization")).toBe(`Basic ${Buffer.from("fake-client:fake-secret").toString("base64")}`);
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({ grant_type: "authorization_code", code: "fake-code", code_verifier: "fake-verifier", redirect_uri: `${appUrl}/api/auth/epic/callback` });
    expect(init.method).toBe("POST");
  });

  it("tokens absent from DB after login; access and refresh tokens revoked", async () => {
    const { state, cookie } = await flow();
    const verifier = String((await db.execute("SELECT code_verifier FROM auth_flows")).rows[0].code_verifier);
    const response = await callback(request(state, cookie));
    expect(response.headers.get("location")).toBe(`${appUrl}/feed`);
    expect(await getSession(db, response.headers.getSetCookie().find((cookie) => cookie.startsWith("__Host-snag_sid=")))).not.toBeNull();
    expect((await db.execute("SELECT subject, display_name FROM identities")).rows).toEqual([{ subject: accountId, display_name: "Epic name" }]);
    const calls = vi.mocked(fetch).mock.calls;
    expect(new URLSearchParams(String(calls[0][1]?.body)).get("code_verifier")).toBe(verifier);
    expect(new Headers(calls[1][1]?.headers).get("authorization")).toBe("Bearer fake-access");
    expect(calls.slice(2).map(([url, init]) => [url, new URLSearchParams(String(init?.body)).get("token")])).toEqual([[`${base}/revoke`, "fake-access"], [`${base}/revoke`, "fake-refresh"]]);
    for (const table of ["users", "identities", "sessions", "auth_flows", "rate_limits"]) {
      const stored = JSON.stringify((await db.execute(`SELECT * FROM ${table}`)).rows);
      for (const secret of [tokens.access_token, tokens.refresh_token, credentials.clientSecret, verifier]) expect(stored).not.toContain(secret);
    }
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("login rotates old session without implicitly linking accounts", async () => {
    await db.execute("INSERT INTO users(id, created_at) VALUES('old-user', 0)");
    const old = await createSession(db, "old-user");
    const { state, cookie } = await flow();
    const response = await callback(request(state, `${cookie}; ${old.cookie.split(";")[0]}`));
    expect(await getSession(db, old.cookie)).toBeNull();
    expect((await getSession(db, response.headers.getSetCookie().find((cookie) => cookie.startsWith("__Host-snag_sid="))))?.userId).not.toBe("old-user");
  });

  it.each([undefined, "false", "TRUE"])("routes return 404 when EPIC_LOGIN_ENABLED is not true (%s)", async (flag) => {
    env.EPIC_LOGIN_ENABLED = flag;
    expect((await start(new Request(`${appUrl}/api/auth/epic`))).status).toBe(404);
    expect((await callback(request("state"))).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
    expect((await db.execute("SELECT * FROM auth_flows")).rows).toHaveLength(0);
  });

  it.each(["error=access_denied&code=fake-code", "", "code="])("provider error or missing code consumes flow and returns generic failure (%s)", async (extra) => {
    const { state, cookie } = await flow();
    expect((await callback(request(state, cookie, extra))).headers.get("location")).toBe(`${appUrl}/login?e=epic`);
    expect((await db.execute("SELECT * FROM auth_flows")).rows).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["token", "userInfo", "revoke"])("%s failure returns generic error, never creates session", async (stage) => {
    const normal = provider();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => String(input) === `${base}/${stage}` ? new Response("provider failure", { status: 500 }) : normal(input, init)));
    const { state, cookie } = await flow();
    expect((await callback(request(state, cookie))).headers.get("location")).toBe(`${appUrl}/login?e=epic`);
    expect((await db.execute("SELECT * FROM sessions")).rows).toHaveLength(0);
    expect((await db.execute("SELECT * FROM auth_flows")).rows).toHaveLength(0);
    if (stage === "userInfo") expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/revoke"))).toHaveLength(2);
  });

  it.each(["invalid account", "invalid profile", "network"])("%s fails safely and revokes issued tokens", async (kind) => {
    const normal = provider();
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (kind === "invalid account" && String(input).endsWith("/token")) return Response.json({ ...tokens, account_id: "" });
      if (String(input).endsWith("/userInfo")) {
        if (kind === "network") throw new Error("fake network failure");
        return Response.json({ preferred_username: 123 });
      }
      return normal(input, init);
    }));
    const { state, cookie } = await flow();
    expect((await callback(request(state, cookie))).headers.get("location")).toBe(`${appUrl}/login?e=epic`);
    expect(vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith("/revoke"))).toHaveLength(2);
    expect((await db.execute("SELECT * FROM sessions")).rows).toHaveLength(0);
    expect((await db.execute("SELECT * FROM auth_flows")).rows).toHaveLength(0);
  });

  it("missing preferred_username falls back to Epic player", async () => {
    const normal = provider();
    const fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => String(input).endsWith("/userInfo") ? Response.json({}) : normal(input, init);
    expect(await exchangeEpicCode({ ...credentials, code: "code", verifier: "verifier" }, fetchFn)).toEqual({ accountId, displayName: "Epic player" });
  });

  it.each(["start", "callback"])("eleventh %s request returns 429 with Retry-After", async (route) => {
    for (let i = 0; i < 10; i++) await (route === "start" ? start(new Request(`${appUrl}/api/auth/epic`)) : callback(request("bad")));
    const response = await (route === "start" ? start(new Request(`${appUrl}/api/auth/epic`)) : callback(request("bad")));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});
