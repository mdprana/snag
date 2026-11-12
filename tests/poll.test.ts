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

const game = { store: "epic" as const, externalId: "offer", kind: "free_to_keep" as const, title: "Fixture", storeUrl: "https://store.epicgames.com/en-US/p/fixture", claimUrl: "https://store.epicgames.com/purchase?offers=fixture", imageUrl: "", startsAt: 1, endsAt: Date.UTC(2026, 10, 13, 1), upcoming: false };
afterEach(() => vi.clearAllMocks());
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
