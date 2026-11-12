import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { PushSubscriptionInput } from "@/src/lib/schemas";
import { getSession } from "@/src/lib/session";
import { hit } from "@/src/lib/ratelimit";
import { randomToken, sha256 } from "@/src/lib/crypto";

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await hit(db(), `push-subscribe:${sha256(session.userId)}`, 5, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const parsed = PushSubscriptionInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  const { endpoint, keys } = parsed.data;
  await db().execute({ sql: "INSERT INTO push_subs(id, user_id, endpoint, p256dh, auth, created_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth", args: [randomToken(16), session.userId, endpoint, keys.p256dh, keys.auth, Date.now()] });
  return NextResponse.json({ ok: true });
}
