import { describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { testDb } from "../helpers/db";
import { createSession } from "@/src/lib/session";

const state = vi.hoisted(() => ({ client: undefined as Client | undefined }));
vi.mock("@/src/lib/db", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/lib/db")>()), db: () => state.client }));

import { POST as subscribe } from "@/app/api/push/subscribe/route";
import { GET as steamStart } from "@/app/api/auth/steam/route";

const endpoint = "https://fcm.googleapis.com/subscription";
const subscription = JSON.stringify({ endpoint, keys: { p256dh: Buffer.alloc(65, 1).toString("base64url"), auth: Buffer.alloc(16, 2).toString("base64url") } });

async function userCookie(client: Client, id: string): Promise<string> {
  await client.execute({ sql: "INSERT INTO users(id, created_at) VALUES(?, ?)", args: [id, Date.now()] });
  return (await createSession(client, id)).cookie;
}

function request(body: string, cookie: string): Request {
  return new Request("https://localhost:3100/api/push/subscribe", {
    method: "POST",
    headers: { cookie, origin: "https://localhost:3100", "content-type": "application/json" },
    body,
  });
}

describe("security routes", () => {
  it("rejects endpoint takeover and preserves original owner", async () => {
    state.client = await testDb();
    const cookieA = await userCookie(state.client, "user-a");
    const cookieB = await userCookie(state.client, "user-b");

    expect((await subscribe(request(subscription, cookieA))).status).toBe(200);
    const response = await subscribe(request(subscription, cookieB));

    expect(response.status).toBe(409);
    const row = await state.client.execute({ sql: "SELECT user_id FROM push_subs WHERE endpoint = ?", args: [endpoint] });
    expect(row.rows[0].user_id).toBe("user-a");
  });

  it("returns 429 after Steam global limit", async () => {
    state.client = await testDb();
    for (let i = 0; i < 10; i++) expect((await steamStart()).status).toBe(307);
    const response = await steamStart();
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBeTruthy();
  });
});
