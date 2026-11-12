import type { Client } from "@libsql/client";
import { db } from "./db";
import { getSession } from "./session";
import { env } from "./env";

export async function requireUser(request: Request): Promise<{ userId: string; steamId?: string }> {
  const client = db();
  const session = await getSession(client, request.headers.get("cookie"));
  if (!session) throw new Response("Unauthorized", { status: 401 });
  const rows = (await client.execute({ sql: "SELECT subject FROM identities WHERE user_id = ? AND provider = 'steam'", args: [session.userId] })).rows;
  return { userId: session.userId, steamId: rows[0] ? String(rows[0].subject) : undefined };
}

export async function requireOwner(db: Client, userId: string, steamId = env.OWNER_STEAMID64): Promise<void> {
  if (!steamId) throw new Response("Not found", { status: 404 });
  const result = await db.execute({ sql: "SELECT 1 FROM identities WHERE user_id = ? AND provider = 'steam' AND subject = ?", args: [userId, steamId] });
  if (!result.rows[0]) throw new Response("Not found", { status: 404 });
}

export async function deleteAccount(db: Client, userId: string): Promise<void> {
  await db.execute({ sql: "DELETE FROM users WHERE id = ?", args: [userId] });
}
