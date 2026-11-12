import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { getSession } from "@/src/lib/session";
import { hit } from "@/src/lib/ratelimit";
import { sha256 } from "@/src/lib/crypto";
import { sendToSub } from "@/src/lib/push";

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await hit(db(), `push-test:${sha256(session.userId)}`, 3, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const { rows } = await db().execute({ sql: "SELECT id, endpoint, p256dh, auth FROM push_subs WHERE user_id = ?", args: [session.userId] });
  const results = await Promise.all(rows.map((row) => sendToSub(db(), { id: String(row.id), endpoint: String(row.endpoint), p256dh: String(row.p256dh), auth: String(row.auth) }, { title: "Snag test notification", body: "Push notifications are working. Tap to claim.", url: "/feed" })));
  return NextResponse.json({ results });
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
