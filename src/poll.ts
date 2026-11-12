import { randomToken } from "./lib/crypto.ts";
import { log } from "./lib/log.ts";
import { notificationText, sendToSub } from "./lib/push.ts";
import { db as defaultDb } from "./lib/db.ts";
import { fetchEpic, type GameRow } from "./sources/epic.ts";
import { fetchGamerPower } from "./sources/gamerpower.ts";
import { fetchSteamStore } from "./sources/steamstore.ts";
import type { Client } from "@libsql/client";

type PushSubscription = { id: string; endpoint: string; p256dh: string; auth: string };
type Send = (subscription: PushSubscription, payload: { title: string; body: string; url: string }) => Promise<unknown>;

export type PollDeps = {
  db?: Client;
  fetchFn?: typeof fetch;
  now?: Date;
  send?: Send;
};

const sources: [string, (fetchFn: typeof fetch) => Promise<GameRow[]>][] = [
  ["epic", fetchEpic],
  ["steam", async (fetchFn) => [...await fetchSteamStore(fetchFn), ...await fetchGamerPower(fetchFn)]],
];

export async function runPoll(deps: PollDeps = {}): Promise<{ source: string; ok: boolean; count: number }[]> {
  const client = deps.db ?? defaultDb();
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? new Date();
  const send = deps.send ?? ((sub, payload) => sendToSub(client, sub, payload));
  const results: { source: string; ok: boolean; count: number }[] = [];

  for (const [source, fetchSource] of sources) {
    try {
      const games = await fetchSource(fetchFn);
      for (const game of games) await saveGame(client, game, now, send);
      await client.execute({ sql: "INSERT INTO poll_runs(source, ok, count, error, at) VALUES(?, 1, ?, NULL, ?)", args: [source, games.length, now.getTime()] });
      results.push({ source, ok: true, count: games.length });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log("error", "poll source failed", { source, error: message });
      await client.execute({ sql: "INSERT INTO poll_runs(source, ok, count, error, at) VALUES(?, 0, 0, ?, ?)", args: [source, message, now.getTime()] });
      results.push({ source, ok: false, count: 0 });
    }
  }
  return results;
}

async function saveGame(client: Client, game: GameRow, now: Date, send: Send): Promise<void> {
  const id = randomToken(16);
  await client.execute({ sql: `INSERT INTO games(id, store, external_id, kind, title, store_url, claim_url, image_url, starts_at, ends_at, upcoming, first_seen_at)
    VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(store, external_id) DO UPDATE SET kind=excluded.kind, title=excluded.title, store_url=excluded.store_url, claim_url=excluded.claim_url, image_url=excluded.image_url, starts_at=excluded.starts_at, ends_at=excluded.ends_at, upcoming=excluded.upcoming`,
    args: [id, game.store, game.externalId, game.kind, game.title, game.storeUrl, game.claimUrl, game.imageUrl, game.startsAt, game.endsAt, Number(game.upcoming), now.getTime()] });
  if (game.upcoming) return;
  const row = await client.execute({ sql: "SELECT id FROM games WHERE store=? AND external_id=?", args: [game.store, game.externalId] });
  const gameId = String(row.rows[0].id);
  await client.execute({ sql: "INSERT OR IGNORE INTO notifications(game_id, created_at) VALUES(?, ?)", args: [gameId, now.getTime()] });
  const subs = await client.execute({ sql: "SELECT s.id, s.endpoint, s.p256dh, s.auth, u.tz FROM push_subs s JOIN users u ON u.id=s.user_id WHERE instr(',' || s.stores || ',', ',' || ? || ',') > 0", args: [game.store] });
  for (const sub of subs.rows as unknown as (PushSubscription & { tz: string })[]) {
    const inserted = await client.execute({ sql: "INSERT OR IGNORE INTO deliveries(game_id, sub_id, sent_at) VALUES(?, ?, NULL)", args: [gameId, sub.id] });
    if (inserted.rowsAffected === 0) continue;
    try {
      const result = await send(sub, { ...notificationText(game, sub.tz), url: `/g/${gameId}` });
      if (result !== "ok") throw new Error("push delivery failed");
      await client.execute({ sql: "UPDATE deliveries SET sent_at=? WHERE game_id=? AND sub_id=?", args: [now.getTime(), gameId, sub.id] });
    } catch {
      await client.execute({ sql: "DELETE FROM deliveries WHERE game_id=? AND sub_id=? AND sent_at IS NULL", args: [gameId, sub.id] });
      log("warn", "push delivery failed");
    }
  }
}
