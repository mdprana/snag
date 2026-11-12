const REDACT = new Set(
  ["cookie", "authorization", "sid", "token", "access_token", "refresh_token", "endpoint", "p256dh", "auth", "steamId", "subject", "code", "state"].map(
    (k) => k.toLowerCase(),
  ),
);

function redact(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(redact);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, REDACT.has(k.toLowerCase()) ? "[redacted]" : redact(x)]),
    );
  }
  return v;
}

export function log(level: "info" | "warn" | "error", msg: string, data?: Record<string, unknown>): void {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...(redact(data ?? {}) as object) });
  (level === "error" ? console.error : level === "warn" ? console.warn : console.log)(line);
}
