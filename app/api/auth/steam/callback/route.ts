import { NextResponse } from "next/server";
import { verifySteamCallback } from "@/src/auth/steam";
import { env } from "@/src/lib/env";
import { db } from "@/src/lib/db";
import { upsertIdentity } from "@/src/lib/users";
import { createSession } from "@/src/lib/session";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const flowId = url.searchParams.get("n") ?? "";
  const flowCookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("__Host-snag_flow="))?.slice("__Host-snag_flow=".length);
  if (!flowCookie || flowCookie !== flowId) return NextResponse.redirect(new URL("/login?e=steam", env.APP_URL));
  const result = await verifySteamCallback(url.searchParams, { appUrl: env.APP_URL, flowId, db: db() });
  if ("error" in result) return NextResponse.redirect(new URL("/login?e=steam", env.APP_URL));
  const userId = await upsertIdentity(db(), "steam", result.steamId, "Steam player");
  const oldSid = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("__Host-snag_sid="))?.slice("__Host-snag_sid=".length);
  const session = await createSession(db(), userId, oldSid);
  const response = NextResponse.redirect(new URL("/feed", env.APP_URL));
  response.cookies.set("__Host-snag_flow", "", { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 0 });
  response.headers.append("set-cookie", session.cookie);
  return response;
}
