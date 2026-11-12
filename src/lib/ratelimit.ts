import type { Client } from "@libsql/client";

export async function hit(db: Client, key: string, limit: number, windowSec: number, now = Date.now()): Promise<{ ok: boolean; retryAfter: number }> {
  const win = windowSec * 1000;
  const start = now - (now % win);
  const [, res] = await db.batch(
    [
      { sql: "DELETE FROM rate_limits WHERE window_start < ?", args: [now - 3_600_000] },
      {
        sql: "INSERT INTO rate_limits(key, window_start, count) VALUES(?, ?, 1) ON CONFLICT(key, window_start) DO UPDATE SET count = count + 1 RETURNING count",
        args: [key, start],
      },
    ],
    "write",
  );
  const ok = Number(res.rows[0].count) <= limit;
  return { ok, retryAfter: ok ? 0 : Math.ceil((start + win - now) / 1000) };
}
