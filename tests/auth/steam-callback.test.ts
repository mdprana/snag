import { expect, it, vi } from "vitest";
import { testDb } from "../helpers/db";
import { createSession, getSession } from "@/src/lib/session";
import { GET } from "@/app/api/auth/steam/callback/route";

const state = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("@/src/lib/db", async (original) => ({ ...await original<typeof import("@/src/lib/db")>(), db: () => state.db }));

it("Steam callback keeps flow deletion and session cookies and rotates old SID", async () => {
  const db = await testDb();
  state.db = db;
  await db.execute("INSERT INTO users(id) VALUES('old')");
  const old = await createSession(db, "old");
  await db.execute({ sql: "INSERT INTO auth_flows(id,provider,expires_at) VALUES('flow','steam',?)", args: [Date.now() + 600000] });
  const query = new URLSearchParams({ n: "flow", "openid.mode": "id_res", "openid.op_endpoint": "https://steamcommunity.com/openid/login", "openid.return_to": "https://localhost:3100/api/auth/steam/callback?n=flow", "openid.response_nonce": "fixture-nonce", "openid.claimed_id": "https://steamcommunity.com/openid/id/76561198000000000", "openid.identity": "https://steamcommunity.com/openid/id/76561198000000000" });
  vi.stubGlobal("fetch", vi.fn(async () => new Response("is_valid:true")));
  try {
    const response = await GET(new Request(`https://localhost:3100/api/auth/steam/callback?${query}`, { headers: { cookie: `__Host-snag_flow=flow; __Host-snag_sid=${old.sid}` } }));
    expect(response.headers.get("location")).toBe("https://localhost:3100/feed");
    const cookies = response.headers.getSetCookie();
    expect(cookies).toEqual(expect.arrayContaining([expect.stringMatching(/^__Host-snag_sid=.+;.*HttpOnly/), expect.stringMatching(/^__Host-snag_flow=;.*Max-Age=0/)]));
    expect(await getSession(db, old.cookie)).toBeNull();
    const sidCookie = cookies.find((cookie) => cookie.startsWith("__Host-snag_sid="))!;
    expect(await getSession(db, sidCookie)).not.toBeNull();
    expect((await db.execute("SELECT * FROM auth_flows")).rows).toHaveLength(0);
  } finally { vi.unstubAllGlobals(); db.close(); }
});
