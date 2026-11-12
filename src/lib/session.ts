import type { Client } from "@libsql/client";
import { randomToken, sha256 } from "./crypto.ts";

export const SESSION_COOKIE = "__Host-snag_sid";
const MAX_AGE = 2592000;

export const sessionCookie = (sid: string, maxAge = MAX_AGE): string =>
  `${SESSION_COOKIE}=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

export const clearSessionCookie = (): string => sessionCookie("", 0);

export function readSid(cookieHeader: string | null | undefined): string | null {
  for (const part of (cookieHeader ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === SESSION_COOKIE) return part.slice(i + 1).trim() || null;
  }
  return null;
}

export async function createSession(db: Client, userId: string, oldSid?: string | null): Promise<{ sid: string; cookie: string }> {
  const sid = randomToken();
  const now = Date.now();
  await db.batch(
    [
      { sql: "DELETE FROM sessions WHERE id_hash = ?", args: [sha256(oldSid ?? "")] },
      { sql: "INSERT INTO sessions(id_hash, user_id, created_at, expires_at) VALUES(?, ?, ?, ?)", args: [sha256(sid), userId, now, now + MAX_AGE * 1000] },
    ],
    "write",
  );
  return { sid, cookie: sessionCookie(sid) };
}

export async function getSession(db: Client, cookieHeader: string | null | undefined): Promise<{ userId: string } | null> {
  const sid = readSid(cookieHeader);
  if (!sid) return null;
  const { rows } = await db.execute({ sql: "SELECT user_id FROM sessions WHERE id_hash = ? AND expires_at > ?", args: [sha256(sid), Date.now()] });
  return rows[0] ? { userId: String(rows[0].user_id) } : null;
}

export async function destroySession(db: Client, sid: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM sessions WHERE id_hash = ?", args: [sha256(sid)] });
}
