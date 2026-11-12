import { beforeEach, expect, it, vi } from "vitest";
import { testDb } from "../helpers/db";
import { createSession } from "@/src/lib/session";
const state = vi.hoisted(() => ({ db: null as Awaited<ReturnType<typeof testDb>> | null }));
vi.mock("@/src/lib/db", async (original) => ({ ...await original<typeof import("@/src/lib/db")>(), db: () => state.db }));
import { PATCH } from "@/app/api/push/[id]/route";
let cookie: string;
beforeEach(async () => {
  state.db = await testDb();
  await state.db.execute("INSERT INTO users(id) VALUES('a'), ('b')");
  cookie = (await createSession(state.db, "a")).cookie;
  await state.db.execute("INSERT INTO push_subs(id,user_id,endpoint,stores) VALUES('device','a','https://web.push.apple.com/test','epic,steam')");
});
it("saves per-device store preferences and rejects foreign devices", async () => {
  const request = () => new Request("https://localhost:3100/api/push/device", { method: "PATCH", headers: { Origin: "https://localhost:3100", Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ epic: true, steam: false }) });
  expect((await PATCH(request(), { params: Promise.resolve({ id: "device" }) })).status).toBe(200);
  expect((await state.db!.execute("SELECT stores FROM push_subs")).rows[0].stores).toBe("epic");
  cookie = (await createSession(state.db!, "b")).cookie;
  expect((await PATCH(request(), { params: Promise.resolve({ id: "device" }) })).status).toBe(404);
});
