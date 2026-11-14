import { safeEqual } from "@/src/lib/crypto";
import { env } from "@/src/lib/env";
import { db } from "@/src/lib/db";
import { hit } from "@/src/lib/ratelimit";
import { boundedBody } from "@/src/lib/request";
import { AsfReport } from "@/src/lib/asf";

export async function POST(request: Request): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!env.ASF_REPORT_SECRET || !safeEqual(token, env.ASF_REPORT_SECRET)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const client = db();
  const rate = await hit(client, "admin:asf-report", 30, 60);
  if (!rate.ok) return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": String(rate.retryAfter) } });
  const body = await boundedBody(request, 8192);
  let input: unknown;
  try { input = body === null ? null : JSON.parse(body); } catch { input = null; }
  const report = AsfReport.safeParse(input);
  if (!report.success) return Response.json({ error: "Invalid report" }, { status: 400 });
  await client.batch([
    "DELETE FROM asf_reports",
    { sql: "INSERT INTO asf_reports(received_at,payload) VALUES(?,?)", args: [Date.now(), JSON.stringify(report.data)] },
  ], "write");
  return Response.json({ ok: true });
}
