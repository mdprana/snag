import { NextResponse } from "next/server";
import { exchangeEpicCode } from "@/src/auth/epic";
import { safeEqual } from "@/src/lib/crypto";
import { db } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { log } from "@/src/lib/log";
import { hit } from "@/src/lib/ratelimit";
import { createSession, readSid } from "@/src/lib/session";
import { upsertIdentity } from "@/src/lib/users";

export async function GET(request: Request): Promise<Response> {
  if (env.EPIC_LOGIN_ENABLED !== "true") return new Response(null, { status: 404 });
  const limit = await hit(db(), "epic-callback:global", 10, 60);
  if (!limit.ok) return new Response(null, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const failure = () => {
    log("warn", "epic_login_failed");
    const response = NextResponse.redirect(new URL("/login?e=epic", env.APP_URL), 302);
    response.cookies.set("__Host-snag_flow", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  const params = new URL(request.url).searchParams;
  const state = params.get("state") ?? "";
  const cookieHeader = request.headers.get("cookie");
  const flowCookie = cookieHeader?.split(";").map((part) => part.trim()).find((part) => part.startsWith("__Host-snag_flow="))?.slice("__Host-snag_flow=".length);
  if (!state || !flowCookie || !safeEqual(state, flowCookie) || params.getAll("state").length !== 1) return failure();
  try {
    const { rows } = await db().execute({ sql: "DELETE FROM auth_flows WHERE id = ? AND provider = 'epic' AND state = ? AND expires_at > ? RETURNING code_verifier", args: [flowCookie, state, Date.now()] });
    const verifier = rows[0]?.code_verifier;
    const code = params.get("code");
    if (typeof verifier !== "string" || !verifier || params.has("error") || !code || params.getAll("code").length !== 1) return failure();
    const identity = await exchangeEpicCode({ code, verifier, clientId: env.EPIC_CLIENT_ID!, clientSecret: env.EPIC_CLIENT_SECRET!, appUrl: env.APP_URL });
    const userId = await upsertIdentity(db(), "epic", identity.accountId, identity.displayName);
    const session = await createSession(db(), userId, readSid(cookieHeader));
    const response = NextResponse.redirect(new URL("/feed", env.APP_URL), 302);
    response.cookies.set("__Host-snag_flow", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
    response.headers.append("set-cookie", session.cookie);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return failure();
  }
}
