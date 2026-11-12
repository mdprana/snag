import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { getSession } from "@/src/lib/session";
import { ClaimInput } from "@/src/lib/schemas";
import { hit } from "@/src/lib/ratelimit";
import { sha256 } from "@/src/lib/crypto";
import { boundedJson } from "@/src/lib/request";

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await hit(db(), `claim:${sha256(session.userId)}`, 30, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const parsed = ClaimInput.safeParse(await boundedJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  const result = await db().execute({ sql: "INSERT OR IGNORE INTO claims(user_id, game_id, claimed_at) SELECT ?, id, ? FROM games WHERE id = ?", args: [session.userId, Date.now(), parsed.data.gameId] });
  if (!result.rowsAffected) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await hit(db(), `claim:${sha256(session.userId)}`, 30, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const parsed = ClaimInput.safeParse(await boundedJson(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  await db().execute({ sql: "DELETE FROM claims WHERE user_id = ? AND game_id = ?", args: [session.userId, parsed.data.gameId] });
  return NextResponse.json({ ok: true });
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "POST, DELETE" } }); }
