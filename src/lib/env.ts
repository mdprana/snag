import { z } from "zod";

const httpsOrigin = z.string().refine((u) => {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && url.origin === u;
  } catch {
    return false;
  }
}, "must be an https:// origin without path or trailing slash");

const secret = z.string().min(32);

const schema = z
  .object({
    APP_URL: httpsOrigin,
    DATABASE_URL: z.string().min(1),
    DATABASE_AUTH_TOKEN: z.string().optional(),
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
    VAPID_PRIVATE_KEY: z.string().min(1),
    VAPID_SUBJECT: z.string().regex(/^(mailto:|https:\/\/)/),
    CRON_SECRET: secret,
    ASF_REPORT_SECRET: secret.optional(),
    OWNER_STEAMID64: z.string().regex(/^\d{17}$/).optional(),
    EPIC_LOGIN_ENABLED: z.string().optional(),
    EPIC_CLIENT_ID: z.string().min(1).optional(),
    EPIC_CLIENT_SECRET: z.string().min(1).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.EPIC_LOGIN_ENABLED !== "true") return;
    for (const k of ["EPIC_CLIENT_ID", "EPIC_CLIENT_SECRET"] as const) {
      if (!e[k]) ctx.addIssue({ code: "custom", path: [k], message: "required when EPIC_LOGIN_ENABLED=true" });
    }
  });

export type Env = z.infer<typeof schema>;

export function parseEnv(src: Record<string, string | undefined>): Env {
  const r = schema.safeParse(Object.fromEntries(Object.entries(src).filter(([, v]) => v !== "")));
  if (!r.success) {
    const bad = r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid environment: ${bad}`);
  }
  return r.data;
}

export const env = parseEnv(process.env);
