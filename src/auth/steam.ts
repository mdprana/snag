import type { Client } from "@libsql/client";
import { randomToken } from "../lib/crypto.ts";

const STEAM_ENDPOINT = "https://steamcommunity.com/openid/login";
const CALLBACK_PATH = "/api/auth/steam/callback";

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function steamLoginUrl(appUrl: string, nonceId: string): string {
  const url = new URL(STEAM_ENDPOINT);
  url.search = new URLSearchParams({
    "openid.ns": "http://specs.openid.net/auth/2.0",
    "openid.mode": "checkid_setup",
    "openid.return_to": `${appUrl}${CALLBACK_PATH}?n=${nonceId}`,
    "openid.realm": appUrl,
    "openid.identity": "http://specs.openid.net/auth/2.0/identifier_select",
    "openid.claimed_id": "http://specs.openid.net/auth/2.0/identifier_select",
  }).toString();
  return url.href;
}

export async function verifySteamCallback(params: URLSearchParams, ctx: { appUrl: string; flowId: string; db: Client; fetchFn?: FetchFn }): Promise<{ steamId: string } | { error: string }> {
  const flow = await ctx.db.execute({ sql: "SELECT id FROM auth_flows WHERE id = ? AND provider = 'steam' AND expires_at > ?", args: [ctx.flowId, Date.now()] });
  if (!flow.rows[0]) return { error: "invalid_flow" };
  if (params.get("openid.mode") !== "id_res" || params.get("openid.op_endpoint") !== STEAM_ENDPOINT) return { error: "invalid_callback" };
  const returnTo = params.get("openid.return_to") ?? "";
  if (returnTo !== `${ctx.appUrl}${CALLBACK_PATH}?n=${ctx.flowId}`) return { error: "invalid_callback" };
  const claimed = params.get("openid.claimed_id") ?? "";
  const identity = params.get("openid.identity") ?? "";
  const match = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(claimed);
  if (!match || claimed !== identity) return { error: "invalid_callback" };
  const nonce = params.get("openid.response_nonce");
  if (!nonce) return { error: "invalid_callback" };
  try {
    await ctx.db.execute({ sql: "INSERT INTO openid_nonces(nonce, seen_at) VALUES(?, ?)", args: [nonce, Date.now()] });
  } catch {
    return { error: "replayed_nonce" };
  }
  const check = new URLSearchParams(params);
  check.set("openid.mode", "check_authentication");
  const response = await (ctx.fetchFn ?? fetch)(STEAM_ENDPOINT, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: check });
  if (!response.ok || !(await response.text()).split(/\r?\n/).includes("is_valid:true")) return { error: "invalid_assertion" };
  await ctx.db.execute({ sql: "DELETE FROM auth_flows WHERE id = ?", args: [ctx.flowId] });
  return { steamId: match[1] };
}

export { randomToken };
