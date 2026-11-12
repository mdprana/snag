import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { destroySession, readSid, clearSessionCookie } from "@/src/lib/session";

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const sid = readSid(request.headers.get("cookie"));
  if (sid) await destroySession(db(), sid);
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.headers.append("set-cookie", clearSessionCookie());
  return response;
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
