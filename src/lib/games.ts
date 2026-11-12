import type { Client } from "@libsql/client";
import { offerState } from "./offers.ts";

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
  confirmedAt?: number | null;
  sourceOk?: boolean;
};

function game(row: Record<string, unknown>): FeedGame {
  return {
    id: String(row.id), store: String(row.store), externalId: String(row.external_id), kind: String(row.kind),
    title: String(row.title), storeUrl: String(row.store_url), claimUrl: String(row.claim_url), imageUrl: String(row.image_url ?? ""),
    startsAt: row.starts_at == null ? null : Number(row.starts_at), endsAt: row.ends_at == null ? null : Number(row.ends_at),
    upcoming: row.starts_at != null && Number(row.starts_at) > Date.now(), claimed: Boolean(row.claimed),
    confirmedAt: row.confirmed_at == null ? null : Number(row.confirmed_at), sourceOk: Boolean(row.source_ok),
  };
}

export async function listFeed(db: Client, userId: string | undefined, now: Date): Promise<{ freeNow: FeedGame[]; upcoming: FeedGame[]; keyGiveaways: FeedGame[] }> {
  const claimed = userId ? "EXISTS (SELECT 1 FROM claims c WHERE c.game_id = g.id AND c.user_id = ?)" : "0";
  const rows = await db.execute({ sql: `SELECT g.*, ${claimed} AS claimed, ${sourceColumns} FROM games g WHERE (g.ends_at IS NULL OR g.ends_at > ?) ORDER BY g.starts_at ASC`, args: userId ? [userId, now.getTime()] : [now.getTime()] });
  const all = rows.rows.map((row) => game(row as Record<string, unknown>)).filter(item => ["active", "upcoming"].includes(offerState(item, now.getTime()))).map(item => ({ ...item, upcoming: offerState(item, now.getTime()) === "upcoming" }));
  return { freeNow: all.filter((item) => !item.upcoming && item.kind === "free_to_keep"), upcoming: all.filter((item) => item.upcoming), keyGiveaways: all.filter((item) => !item.upcoming && item.kind === "key_giveaway") };
}

export async function listArchive(db: Client, now: Date): Promise<FeedGame[]> {
  const rows = await db.execute({ sql: `SELECT g.*, 0 AS claimed, ${sourceColumns} FROM games g WHERE g.ends_at IS NOT NULL AND g.ends_at <= ? ORDER BY g.ends_at DESC LIMIT 12`, args: [now.getTime()] });
  return rows.rows.map((row) => game(row as Record<string, unknown>));
}

const sourceName = "CASE WHEN g.store='epic' THEN 'epic' WHEN g.kind='key_giveaway' THEN 'gamerpower' ELSE 'steam' END";
const sourceColumns = `(SELECT MAX(at) FROM poll_runs WHERE source=${sourceName} AND ok=1) AS confirmed_at,
  (SELECT ok FROM poll_runs WHERE source=${sourceName} ORDER BY at DESC, id DESC LIMIT 1) AS source_ok`;

export async function getGame(db: Client, id: string): Promise<FeedGame | null> {
  const result = await db.execute({ sql: `SELECT g.*, 0 AS claimed, ${sourceColumns} FROM games g WHERE g.id = ?`, args: [id] });
  return result.rows[0] ? game(result.rows[0] as Record<string, unknown>) : null;
}

export function soonestEnding(games: FeedGame[]): FeedGame | null {
  return games.reduce<FeedGame | null>((best, item) => item.endsAt !== null && (!best || item.endsAt < best.endsAt!) ? item : best, null);
}

export async function lastPoll(db: Client): Promise<number | null> {
  const result = await db.execute("SELECT source, MAX(at) AS at FROM poll_runs WHERE ok = 1 AND source IN ('epic','steam','gamerpower') GROUP BY source");
  return result.rows.length < 3 ? null : Math.min(...result.rows.map(row => Number(row.at)));
}
