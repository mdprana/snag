import type { Client } from "@libsql/client";

export type FeedGame = {
  id: string;
  store: string;
  externalId: string;
  kind: string;
  title: string;
  storeUrl: string;
  claimUrl: string;
  imageUrl: string;
  startsAt: number | null;
  endsAt: number | null;
  upcoming: boolean;
  claimed: boolean;
};

function game(row: Record<string, unknown>): FeedGame {
  return {
    id: String(row.id), store: String(row.store), externalId: String(row.external_id), kind: String(row.kind),
    title: String(row.title), storeUrl: String(row.store_url), claimUrl: String(row.claim_url), imageUrl: String(row.image_url ?? ""),
    startsAt: row.starts_at == null ? null : Number(row.starts_at), endsAt: row.ends_at == null ? null : Number(row.ends_at),
    upcoming: Boolean(row.upcoming), claimed: Boolean(row.claimed),
  };
}

export async function listFeed(db: Client, userId: string | undefined, now: Date): Promise<{ freeNow: FeedGame[]; upcoming: FeedGame[]; keyGiveaways: FeedGame[] }> {
  const claimed = userId ? "EXISTS (SELECT 1 FROM claims c WHERE c.game_id = g.id AND c.user_id = ?)" : "0";
  const rows = await db.execute({ sql: `SELECT g.*, ${claimed} AS claimed FROM games g WHERE (g.upcoming = 1 OR (g.starts_at <= ? AND (g.ends_at IS NULL OR g.ends_at > ?))) ORDER BY g.starts_at ASC`, args: userId ? [userId, now.getTime(), now.getTime()] : [now.getTime(), now.getTime()] });
  const all = rows.rows.map((row) => game(row as Record<string, unknown>));
  return { freeNow: all.filter((item) => !item.upcoming && item.kind === "free_to_keep"), upcoming: all.filter((item) => item.upcoming), keyGiveaways: all.filter((item) => !item.upcoming && item.kind === "key_giveaway") };
}

export async function getGame(db: Client, id: string): Promise<FeedGame | null> {
  const result = await db.execute({ sql: "SELECT *, 0 AS claimed FROM games WHERE id = ?", args: [id] });
  return result.rows[0] ? game(result.rows[0] as Record<string, unknown>) : null;
}
