import { z } from "zod";

const BASE = "https://api.epicgames.dev/epic/oauth/v2";
const CALLBACK_PATH = "/api/auth/epic/callback";
type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function epicAuthorizeUrl({ clientId, appUrl, state, codeChallenge }: { clientId: string; appUrl: string; state: string; codeChallenge: string }): string {
  const url = new URL("https://www.epicgames.com/id/authorize");
  url.search = new URLSearchParams({ client_id: clientId, redirect_uri: `${appUrl}${CALLBACK_PATH}`, response_type: "code", scope: "basic_profile", state, code_challenge: codeChallenge, code_challenge_method: "S256" }).toString();
  return url.href;
}

export async function exchangeEpicCode({ code, verifier, clientId, clientSecret, appUrl }: { code: string; verifier: string; clientId: string; clientSecret: string; appUrl: string }, fetchFn: FetchFn = fetch): Promise<{ accountId: string; displayName: string }> {
  const authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  const headers = { authorization, "content-type": "application/x-www-form-urlencoded" };
  const response = await fetchFn(`${BASE}/token`, { method: "POST", headers, body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: `${appUrl}${CALLBACK_PATH}`, code_verifier: verifier }), signal: AbortSignal.timeout(15000), redirect: "error" });
  if (!response.ok) throw new Error("epic_token_failed");
  const tokens = z.object({ access_token: z.string().min(1), refresh_token: z.string().min(1).optional(), account_id: z.unknown() }).parse(await response.json());
  try {
    const accountId = z.string().regex(/^[a-fA-F0-9]{32}$/).parse(tokens.account_id);
    const profile = await fetchFn(`${BASE}/userInfo`, { headers: { authorization: `Bearer ${tokens.access_token}` }, signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!profile.ok) throw new Error("epic_profile_failed");
    const info = z.object({ preferred_username: z.string().trim().min(1).max(256).optional() }).parse(await profile.json());
    return { accountId, displayName: info.preferred_username ?? "Epic player" };
  } finally {
    const revoked = await Promise.allSettled([tokens.access_token, tokens.refresh_token].filter((token): token is string => !!token).map(async (token) => {
      const result = await fetchFn(`${BASE}/revoke`, { method: "POST", headers, body: new URLSearchParams({ token }), signal: AbortSignal.timeout(15000), redirect: "error" });
      if (!result.ok) throw new Error("epic_revoke_failed");
    }));
    if (revoked.some((result) => result.status === "rejected")) throw new Error("epic_revoke_failed");
  }
}
