import { NextResponse } from "next/server";
import { safeEqual } from "@/src/lib/crypto";
import { env } from "@/src/lib/env";
import { runPoll } from "@/src/poll";

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!safeEqual(token, env.CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ results: await runPoll() });
}

export function GET(): Response {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
