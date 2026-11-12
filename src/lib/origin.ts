import { env } from "./env.ts";

export function assertSameOrigin(req: Request): Response | null {
  return req.headers.get("origin") === env.APP_URL ? null : new Response("Forbidden", { status: 403 });
}
