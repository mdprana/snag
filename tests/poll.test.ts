import { afterEach, expect, it, vi } from "vitest";
import { testDb } from "./helpers/db";
import { runPoll } from "@/src/poll";
import { notificationText, sendToSub } from "@/src/lib/push";

vi.mock("@/src/lib/push", async () => ({ ...(await vi.importActual("@/src/lib/push")), sendToSub: vi.fn(async () => "ok") }));
vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
vi.mock("@/src/sources/epic.ts", () => ({ fetchEpic: vi.fn() }));
vi.mock("@/src/sources/steamstore.ts", () => ({ fetchSteamStore: vi.fn(async () => []) }));
vi.mock("@/src/sources/gamerpower.ts", () => ({ fetchGamerPower: vi.fn(async () => []) }));
import { fetchEpic } from "@/src/sources/epic";
import { fetchSteamStore } from "@/src/sources/steamstore";
import { fetchGamerPower } from "@/src/sources/gamerpower";
import { parseEpicMetadata, readMetadata } from "@/src/lib/metadata";

it("persists Epic metadata without extra pushes and isolates metadata failure from offers", async () => {
  const db = await setup();
  const metadata = parseEpicMetadata({ id: "offer", namespace: "ns", description: "Summary", keyImages: [] }, "offer", "ns", 100);
  vi.mocked(fetchEpic).mockResolvedValue([{ ...game, metadata, providerNamespace: "ns" }]);
  const send = vi.fn(async () => "ok" as const);
  await runPoll({ db, send });
  const id = String((await db.execute("SELECT id FROM games")).rows[0].id);
  expect((await readMetadata(db, id))?.aboutText).toBe("Summary");
  await runPoll({ db, send });
  expect(send).toHaveBeenCalledTimes(1);
  await db.execute("DROP TABLE game_metadata");
  expect((await runPoll({ db, send }))[0].ok).toBe(true);
  db.close();
});

const game = { store: "epic" as const, externalId: "offer", kind: "free_to_keep" as const, title: "Fixture", storeUrl: "https://store.epicgames.com/en-US/p/fixture", claimUrl: "https://store.epicgames.com/purchase?offers=fixture", imageUrl: "", startsAt: 1, endsAt: Date.UTC(2026, 10, 13, 1), upcoming: false };
afterEach(() => { vi.clearAllMocks(); vi.mocked(fetchSteamStore).mockResolvedValue([]); vi.mocked(fetchGamerPower).mockResolvedValue([]); });
it("reconciles missing offers only for independently successful source, preserving claims and IDs", async () => {
  const db = await testDb();
  vi.mocked(fetchEpic).mockResolvedValue([]);
  const steam = { ...game, store: "steam" as const, externalId: "123", startsAt: null, endsAt: null };
  vi.mocked(fetchSteamStore).mockResolvedValue([steam]);
  vi.mocked(fetchGamerPower).mockRejectedValue(new Error("offline"));
  await runPoll({ db, now: new Date(100) });
  const id = (await db.execute("SELECT id FROM games")).rows[0].id;
  await db.execute("INSERT INTO users(id) VALUES('owner')");
  await db.execute({ sql: "INSERT INTO claims(user_id,game_id) VALUES('owner',?)", args: [id] });
  vi.mocked(fetchSteamStore).mockRejectedValue(new Error("partial"));
  await runPoll({ db, now: new Date(200) });
  expect((await db.execute("SELECT ends_at FROM games")).rows[0].ends_at).toBeNull();
  vi.mocked(fetchSteamStore).mockResolvedValue([]);
  await runPoll({ db, now: new Date(300) });
  expect((await db.execute("SELECT id,ends_at FROM games")).rows[0]).toMatchObject({ id, ends_at: 300 });
  expect((await db.execute("SELECT * FROM claims")).rows).toHaveLength(1);
  db.close();
});

async function setup(upcoming = false) {
  const db = await testDb();
  await db.execute("INSERT INTO users(id,tz) VALUES('reader','America/Los_Angeles')");
  await db.execute("INSERT INTO push_subs(id,user_id,endpoint,p256dh,auth) VALUES('device','reader','https://fcm.googleapis.com/fixture','key','auth')");
  vi.mocked(fetchEpic).mockResolvedValue([{ ...game, upcoming }]);
  return db;
}
it("persists upcoming without notifying then notifies when active", async () => {
  const db = await setup(true);
  const send = vi.fn(async () => "ok" as const);
  await runPoll({ db, send });
  expect((await db.execute("SELECT upcoming FROM games")).rows[0]?.upcoming).toBe(1);
  expect((await db.execute("SELECT * FROM notifications")).rows).toHaveLength(0);
  expect(send).not.toHaveBeenCalled();
  vi.mocked(fetchEpic).mockResolvedValue([game]);
  await runPoll({ db, send });
  await runPoll({ db, send });
  expect(send).toHaveBeenCalledTimes(1);
  expect((await db.execute("SELECT upcoming FROM games")).rows[0]?.upcoming).toBe(0);
  db.close();
});
it("default sender receives client and user timezone copy", async () => {
  const db = await setup();
  await runPoll({ db });
  expect(sendToSub).toHaveBeenCalledWith(db, expect.objectContaining({ id: "device" }), expect.objectContaining(notificationText(game, "America/Los_Angeles")));
  db.close();
});
it.each(["error", "throw"])("retries failed %s delivery without marking sent", async (failure) => {
  const db = await setup();
  const send = vi.fn().mockImplementationOnce(async () => { if (failure === "throw") throw new Error("fixture failure"); return "error"; }).mockResolvedValue("ok");
  await runPoll({ db, send });
  expect((await db.execute("SELECT * FROM deliveries WHERE sent_at IS NOT NULL")).rows).toHaveLength(0);
  await runPoll({ db, send });
  await runPoll({ db, send });
  expect(send).toHaveBeenCalledTimes(2);
  expect((await db.execute("SELECT * FROM deliveries WHERE sent_at IS NOT NULL")).rows).toHaveLength(1);
  db.close();
});
