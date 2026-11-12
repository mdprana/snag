import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { getSession } from "@/src/lib/session";
import { NotifPrefsInput } from "@/src/lib/schemas";
import { hit } from "@/src/lib/ratelimit";
import { sha256 } from "@/src/lib/crypto";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await hit(db(), `push-mutation:${sha256(session.userId)}`, 30, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const { id } = await params;
  const result = await db().execute({ sql: "DELETE FROM push_subs WHERE id = ? AND user_id = ?", args: [id, session.userId] });
  if (!result.rowsAffected) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const limit = await hit(db(), `push-mutation:${sha256(session.userId)}`, 30, 60);
  if (!limit.ok) return NextResponse.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const parsed = NotifPrefsInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid preferences" }, { status: 400 });
  const stores = [parsed.data.epic && "epic", parsed.data.steam && "steam"].filter(Boolean).join(",");
  const result = await db().execute({ sql: "UPDATE push_subs SET stores = ? WHERE id = ? AND user_id = ?", args: [stores, (await params).id, session.userId] });
  return result.rowsAffected ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Not found" }, { status: 404 });
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "DELETE, PATCH" } }); }
