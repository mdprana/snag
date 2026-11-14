import { afterEach, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import { testDb } from "./helpers/db";
import { env } from "@/src/lib/env";
import { createSession } from "@/src/lib/session";

const state = vi.hoisted(() => ({ client: undefined as Client | undefined, cookie: "" }));
vi.mock("@/src/lib/db", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/src/lib/db")>()), db: () => state.client }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ cookie: state.cookie }) }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("404"); } }));
import { POST } from "@/app/api/admin/asf-report/route";
import AdminPage from "@/app/admin/page";

const secret = "test-report-secret-00000000000000000";
const payload = { online: true, history: "unavailable" };
function request(body: BodyInit = JSON.stringify(payload), token = secret) {
  return new Request("https://localhost:3100/api/admin/asf-report", { method: "POST", headers: { authorization: `Bearer ${token}` }, body });
}
afterEach(() => { state.client?.close(); delete env.ASF_REPORT_SECRET; delete env.OWNER_STEAMID64; state.cookie = ""; });

it("rejects missing, wrong, length-mismatched and unconfigured bearer secrets", async () => {
  env.ASF_REPORT_SECRET = secret;
  for (const token of ["", "wrong", `${secret}extra`]) expect((await POST(request(undefined, token))).status).toBe(401);
  delete env.ASF_REPORT_SECRET;
  expect((await POST(request())).status).toBe(401);
});

it("strictly rejects invalid, unknown, oversized and malformed UTF-8 payloads", async () => {
  state.client = await testDb(); env.ASF_REPORT_SECRET = secret;
  for (const body of ["{", JSON.stringify({ ...payload, token: "private" }), JSON.stringify({ online: 1, history: "unavailable" }), JSON.stringify({ online: true, history: "available" }), "x".repeat(1025), new Uint8Array([0xc3, 0x28])]) {
    expect((await POST(request(body))).status).toBe(400);
  }
  expect((await state.client.execute("SELECT * FROM asf_reports")).rows).toHaveLength(0);
});

it("accepts bounded claim history and rejects invalid entries or bodies over 8 KiB", async () => {
  state.client = await testDb(); env.ASF_REPORT_SECRET = secret;
  const claim = { at: "2026-11-13T03:21:59.000Z", kind: "sub", id: 12345, result: "OK/NoDetail" };
  expect((await POST(request(JSON.stringify({ online: true, history: Array(20).fill(claim) })))).status).toBe(200);
  expect((await POST(request(JSON.stringify({ online: true, history: [] })))).status).toBe(200);
  for (const history of [Array(21).fill(claim), [{ ...claim, raw: "line" }], [{ ...claim, kind: "bundle" }], [{ ...claim, id: 0 }], [{ ...claim, id: 4294967296 }], [{ ...claim, result: "OK" }], [{ ...claim, result: "OK/<b>" }], [{ ...claim, at: "2026-11-13 03:21:59" }]]) {
    expect((await POST(request(JSON.stringify({ online: true, history })))).status).toBe(400);
  }
  const big = JSON.stringify({ online: true, history: "unavailable" }).padEnd(8193, " ");
  expect(JSON.parse(big)).toEqual(payload);
  expect((await POST(request(big))).status).toBe(400);
  expect(JSON.parse(String((await state.client.execute("SELECT payload FROM asf_reports")).rows[0].payload)).history).toEqual([]);
});

it("stores only latest bounded report and rate limits intake", async () => {
  state.client = await testDb(); env.ASF_REPORT_SECRET = secret;
  for (let i = 0; i < 30; i++) expect((await POST(request())).status).toBe(200);
  expect((await state.client.execute("SELECT * FROM asf_reports")).rows).toHaveLength(1);
  const response = await POST(request());
  expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBeTruthy();
});

it("hides owner page from anonymous, non-owner and missing owner configuration", async () => {
  state.client = await testDb();
  await expect(AdminPage()).rejects.toThrow("404");
  await state.client.execute("INSERT INTO users(id) VALUES('reader')");
  state.cookie = (await createSession(state.client, "reader")).cookie;
  env.OWNER_STEAMID64 = "76561198000000000";
  await expect(AdminPage()).rejects.toThrow("404");
  await state.client.execute("INSERT INTO identities(provider,subject,user_id) VALUES('steam','76561198000000000','reader')");
  await expect(AdminPage()).resolves.toBeTruthy();
  delete env.OWNER_STEAMID64;
  await expect(AdminPage()).rejects.toThrow("404");
});
