import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { epicAuthorizeUrl } from "@/src/auth/epic";
import { randomToken } from "@/src/lib/crypto";
import { db } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { hit } from "@/src/lib/ratelimit";

export async function GET(): Promise<Response> {
  if (env.EPIC_LOGIN_ENABLED !== "true") return new Response(null, { status: 404 });
  const limit = await hit(db(), "epic-start:global", 10, 60);
  if (!limit.ok) return new Response(null, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const state = randomToken();
  const verifier = randomToken();
  const codeChallenge = createHash("sha256").update(verifier).digest("base64url");
  await db().execute({ sql: "INSERT INTO auth_flows(id, provider, state, code_verifier, expires_at) VALUES(?, 'epic', ?, ?, ?)", args: [state, state, verifier, Date.now() + 600000] });
  const response = NextResponse.redirect(epicAuthorizeUrl({ clientId: env.EPIC_CLIENT_ID!, appUrl: env.APP_URL, state, codeChallenge }), 302);
  response.cookies.set("__Host-snag_flow", state, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
