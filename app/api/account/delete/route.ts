import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { deleteAccount, requireUser } from "@/src/lib/auth";
import { boundedBody } from "@/src/lib/request";

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const body = await boundedBody(request);
  if (body === null) return NextResponse.json({ error: "Request too large" }, { status: 413 });
  const form = new URLSearchParams(body);
  if (form.get("confirm") !== "DELETE") return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  const user = await requireUser(request);
  await deleteAccount(db(), user.userId);
  return NextResponse.redirect(new URL("/", request.url));
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
