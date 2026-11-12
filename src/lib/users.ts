import type { Client } from "@libsql/client";
import { randomToken } from "./crypto.ts";

export async function upsertIdentity(db: Client, provider: "steam" | "epic", subject: string, displayName: string, currentUserId?: string): Promise<string> {
  const existing = await db.execute({ sql: "SELECT user_id FROM identities WHERE provider = ? AND subject = ?", args: [provider, subject] });
  if (existing.rows[0]) return String(existing.rows[0].user_id);
  const userId = currentUserId ?? randomToken(16);
  await db.batch([
    { sql: "INSERT OR IGNORE INTO users(id, created_at) VALUES(?, ?)", args: [userId, Date.now()] },
    { sql: "INSERT INTO identities(provider, subject, user_id, display_name, created_at) VALUES(?, ?, ?, ?, ?)", args: [provider, subject, userId, displayName, Date.now()] },
  ], "write");
  return userId;
}
