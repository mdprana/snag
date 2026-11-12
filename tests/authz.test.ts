import { describe, expect, it } from "vitest";
import { testDb } from "./helpers/db";
import { getGame, listFeed } from "@/src/lib/games";

async function seed() {
  const db = await testDb();
  await db.execute({ sql: "INSERT INTO users(id, created_at) VALUES(?, ?)", args: ["u1", 1] });
  await db.batch([
    { sql: "INSERT INTO games VALUES(?, 'epic', ?, 'free_to_keep', ?, ?, ?, ?, ?, ?, ?, ?)", args: ["now", "now", "Now", "https://store.epicgames.com/en-US/p/now", "https://store.epicgames.com/purchase?offers=now", "", 900, 2000, 0, 1] },
    { sql: "INSERT INTO games VALUES(?, 'epic', ?, 'free_to_keep', ?, ?, ?, ?, ?, ?, ?, ?)", args: ["expired", "expired", "Expired", "https://store.epicgames.com/en-US/p/expired", "https://store.epicgames.com/purchase?offers=expired", "", 1, 900, 0, 1] },
    { sql: "INSERT INTO games VALUES(?, 'epic', ?, 'free_to_keep', ?, ?, ?, ?, ?, ?, ?, ?)", args: ["upcoming", "upcoming", "Upcoming", "https://store.epicgames.com/en-US/p/upcoming", "https://store.epicgames.com/purchase?offers=upcoming", "", 2000, 3000, 1, 1] },
  ]);
  return db;
}

describe("feed games", () => {
  it("hides expired games and includes claims", async () => {
    const db = await seed();
    await db.execute({ sql: "INSERT INTO claims VALUES(?, ?, ?)", args: ["u1", "now", 100] });
    const feed = await listFeed(db, "u1", new Date(1000));
    expect(feed.freeNow.map((game) => game.id)).toEqual(["now"]);
    expect(feed.freeNow[0].claimed).toBe(true);
    expect(feed.freeNow.map((game) => game.id)).not.toContain("expired");
  });

  it("lists upcoming separately", async () => {
    const db = await seed();
    const feed = await listFeed(db, undefined, new Date(1000));
    expect(feed.upcoming.map((game) => game.id)).toEqual(["upcoming"]);
    expect(feed.freeNow.map((game) => game.id)).toEqual(["now"]);
  });

  it("gets one game by id", async () => {
    const db = await seed();
    expect((await getGame(db, "now"))?.title).toBe("Now");
    expect(await getGame(db, "missing")).toBeNull();
  });
});
