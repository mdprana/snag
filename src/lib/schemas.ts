import { z } from "zod";

const PUSH_HOSTS = ["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"];

const pushEndpoint = z
  .string()
  .max(2048)
  .refine((s) => {
    if (!URL.canParse(s)) return false;
    const u = new URL(s);
    if (u.protocol !== "https:" || u.port || u.username || u.password) return false;
    return PUSH_HOSTS.includes(u.hostname) || u.hostname.endsWith(".push.apple.com");
  }, "endpoint not an allowed push service");

const b64urlBytes = (n: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+={0,2}$/)
    .refine((s) => Buffer.from(s, "base64url").length === n, `must decode to ${n} bytes`);

export const PushSubscriptionInput = z.object({
  endpoint: pushEndpoint,
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: b64urlBytes(65), auth: b64urlBytes(16) }),
});

export const ClaimInput = z.strictObject({ gameId: z.string().min(1).max(200) });

export const NotifPrefsInput = z.strictObject({ epic: z.boolean(), steam: z.boolean() });
