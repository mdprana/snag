import { NextResponse } from "next/server";
import { db } from "@/src/lib/db";
import { assertSameOrigin } from "@/src/lib/origin";
import { deleteAccount, requireUser } from "@/src/lib/auth";

export async function POST(request: Request): Promise<Response> {
  const forbidden = assertSameOrigin(request);
  if (forbidden) return forbidden;
  const form = await request.formData();
  if (form.get("confirm") !== "DELETE") return NextResponse.json({ error: "Confirmation required" }, { status: 400 });
  const user = await requireUser(request);
  await deleteAccount(db(), user.userId);
  return NextResponse.redirect(new URL("/", request.url));
}

export function GET(): Response { return new Response(null, { status: 405, headers: { Allow: "POST" } }); }
