import { describe, it, expect } from "vitest";
import { migrate } from "@/src/lib/db";
import { testDb } from "./helpers/db";

describe("db", () => {
  it("migrate is idempotent", async () => {
    const c = await testDb();
    expect(await migrate(c)).toEqual([]);
    const { rows } = await c.execute("SELECT name FROM _migrations");
    expect(rows.map((r) => r.name)).toEqual(["001_init.sql"]);
  });

  it("deleting user cascades to identities, sessions, claims, push_subs", async () => {
    const c = await testDb();
    expect((await c.execute("PRAGMA foreign_keys")).rows[0].foreign_keys).toBe(1);
    await c.batch([
      "INSERT INTO users(id, created_at) VALUES('u1', 1)",
      "INSERT INTO identities(provider, subject, user_id, created_at) VALUES('steam', '765', 'u1', 1)",
      "INSERT INTO sessions(id_hash, user_id, created_at, expires_at) VALUES('h', 'u1', 1, 2)",
      "INSERT INTO games(id, store, external_id, kind, title) VALUES('g1', 'epic', 'x', 'free_to_keep', 'G')",
      "INSERT INTO claims(user_id, game_id, claimed_at) VALUES('u1', 'g1', 1)",
      "INSERT INTO push_subs(id, user_id, endpoint, p256dh, auth, created_at) VALUES('s1', 'u1', 'https://push.example/1', 'p', 'a', 1)",
      "INSERT INTO deliveries(game_id, sub_id, sent_at) VALUES('g1', 's1', 1)",
      "DELETE FROM users WHERE id = 'u1'",
    ]);
    for (const t of ["identities", "sessions", "claims", "push_subs", "deliveries"]) {
      expect((await c.execute(`SELECT count(*) AS n FROM ${t}`)).rows[0].n, t).toBe(0);
    }
    expect((await c.execute("SELECT count(*) AS n FROM games")).rows[0].n).toBe(1);
  });

  it("games unique on store+external_id", async () => {
    const c = await testDb();
    const ins = "INSERT INTO games(id, store, external_id, kind, title) VALUES(?, ?, 'x', 'free_to_keep', 'G')";
    await c.execute({ sql: ins, args: ["g1", "epic"] });
    await c.execute({ sql: ins, args: ["g2", "steam"] });
    await expect(c.execute({ sql: ins, args: ["g3", "epic"] })).rejects.toThrow(/UNIQUE/);
  });
});
