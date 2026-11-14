import { NextRequest, NextResponse } from "next/server";
import { buildCsp, securityHeaders } from "@/src/lib/headers";
import { db } from "@/src/lib/db";
import { getSession } from "@/src/lib/session";
import { requireOwner } from "@/src/lib/auth";

async function isOwner(request: NextRequest): Promise<boolean> {
  try {
    const client = db();
    const session = await getSession(client, request.headers.get("cookie"));
    if (!session) return false;
    await requireOwner(client, session.userId);
    return true;
  } catch { return false; }
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const hidden = /^\/admin\/?$/.test(request.nextUrl.pathname) && !await isOwner(request);
  const response = hidden
    ? NextResponse.rewrite(new URL("/_admin-not-found", request.url), { request: { headers: requestHeaders }, status: 404 })
    : NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  for (const [k, v] of Object.entries(securityHeaders())) response.headers.set(k, v);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
