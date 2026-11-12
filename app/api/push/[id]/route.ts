import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { getSession } from "@/src/lib/session";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const session = await getSession(db(), request.headers.get("cookie"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await db().execute({ sql: "DELETE FROM push_subs WHERE id = ? AND user_id = ?", args: [id, session.userId] });
  if (!result.rowsAffected) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "DELETE" } }); }
