import { NextResponse } from "next/server";
import { randomToken } from "@/src/lib/crypto";
import { db } from "@/src/lib/db";
import { env } from "@/src/lib/env";
import { steamLoginUrl } from "@/src/auth/steam";

export async function GET(): Promise<Response> {
  const nonceId = randomToken();
  await db().execute({ sql: "INSERT INTO auth_flows(id, provider, expires_at) VALUES(?, 'steam', ?)", args: [nonceId, Date.now() + 600000] });
  const response = NextResponse.redirect(steamLoginUrl(env.APP_URL, nonceId));
  response.cookies.set("__Host-snag_flow", nonceId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
