import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mergeHistory, parseHistory, reportAsf } from "./asf-report.mjs";

const dir = await mkdtemp(join(tmpdir(), "asf-report-check-"));
const state = join(dir, "state", "asf-history.json");
const config = { ASF_IPC_URL: "http://127.0.0.1:1242", APP_URL: "https://snag.example.com", ASF_BOT: "bot", ASF_IPC_PASSWORD: "i".repeat(32), ASF_REPORT_SECRET: "s".repeat(32), ASF_REPORT_STATE: state };
const line = (bot, id, status = "OK/NoDetail", time = "2026-11-13 03:21:59") => `${time}|ArchiSteamFarm-123|INFO|${bot}|ClaimFreeSub() ID: sub/${id} | Status: ${status}`;
const at = new Date("2026-11-13T03:21:59").toISOString();

const parsed = parseHistory([
  line("bot", 12345),
  "2026-11-13 03:22:00|ArchiSteamFarm-1|DEBUG|bot|ClaimFreeApp() ID: app/440 | Status: AccessDenied/InvalidPackage",
  line("other", 1),
  line("bot", 2, "OK/NoDetail\n2026-11-13 03:21:59|x|INFO|bot|ClaimFreeSub() ID: sub/3 | Status: OK/OK"),
  `${line("bot", 4)} token=secret`,
  "2026-11-13 03:21:59|x|INFO|bot|ClaimFreeSub() ID: app/5 | Status: OK/OK",
  line("bot", 12345678901),
  line("bot", 6, "<script>/x"),
  "junk", 42, null,
], "bot");
assert.deepEqual(parsed, [
  { at, kind: "sub", id: 12345, result: "OK/NoDetail" },
  { at: new Date("2026-11-13T03:22:00").toISOString(), kind: "app", id: 440, result: "AccessDenied/InvalidPackage" },
]);
assert.equal(mergeHistory(parsed, parsed).length, 2);
const many = Array.from({ length: 30 }, (_, i) => ({ at: new Date(Date.UTC(2026, 0, 1, 0, i)).toISOString(), kind: "sub", id: i + 1, result: "OK/NoDetail" }));
const capped = mergeHistory(many);
assert.equal(capped.length, 20);
assert.equal(capped[0].id, 30);
assert.equal(mergeHistory([{ ...many[0], extra: 1 }]).length, 0);

let calls = [];
let nlog = () => Response.json({ Success: true, Result: { Content: [line("bot", 12345), line("other", 9), "raw private line"], TotalLines: 3 } });
const fetchFn = async (url, options) => {
  calls.push([String(url), options]);
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  if (calls.length === 1) return Response.json({ Success: true, Result: { bot: { IsConnectedAndLoggedOn: true, SteamID: "private", BotConfig: { token: "private" } } } });
  if (String(url).includes("/Api/NLog/")) return nlog();
  return Response.json({ ok: true });
};
assert.equal(await reportAsf({ ...config, ASF_REPORT_STATE: undefined, HOME: undefined }, fetchFn), false);
calls = [];
assert.equal(await reportAsf(config, fetchFn), true);
assert.equal(calls[0][0], "http://127.0.0.1:1242/Api/Bot/bot");
assert.equal(calls[1][0], "http://127.0.0.1:1242/Api/NLog/File?count=500");
assert.equal(calls[1][1].headers.Authentication, config.ASF_IPC_PASSWORD);
assert.deepEqual(JSON.parse(calls[2][1].body), { online: true, history: [{ at, kind: "sub", id: 12345, result: "OK/NoDetail" }] });
assert.equal((await stat(state)).mode & 0o777, 0o600);
assert.equal((await stat(join(dir, "state"))).mode & 0o777, 0o700);

calls = [];
nlog = () => new Response("down", { status: 500 });
assert.equal(await reportAsf(config, fetchFn), true);
assert.deepEqual(JSON.parse(calls[2][1].body).history, [{ at, kind: "sub", id: 12345, result: "OK/NoDetail" }]);
assert.equal(JSON.parse(await readFile(state, "utf8")).length, 1);

calls = [];
await rm(state);
assert.equal(await reportAsf(config, fetchFn), true);
assert.deepEqual(JSON.parse(calls[2][1].body), { online: true, history: "unavailable" });

for (const url of ["http://example.com:1242", "http://localhost:1242", "http://127.0.0.1.evil.com", "http://127.0.0.1/path", "http://user:pass@127.0.0.1", "http://127.0.0.1?password=secret"]) {
  calls = [];
  assert.equal(await reportAsf({ ...config, ASF_IPC_URL: url }, fetchFn), false);
  assert.equal(calls.length, 0);
}
assert.equal(await reportAsf(config, async () => { throw new Error("private-token-and-body"); }), false);
assert.equal(await reportAsf(config, async () => new Response("private IPC error", { status: 500 })), false);
assert.equal(await reportAsf(config, async () => Response.json({ Success: true, Result: { bot: { IsConnectedAndLoggedOn: "true" } } })), false);
assert.equal(await reportAsf(config, async () => new Response("x".repeat(1024 * 1024 + 1), { headers: { "content-type": "application/json" } })), false);
const originalTimeout = AbortSignal.timeout;
AbortSignal.timeout = () => originalTimeout(5);
const keepAlive = setInterval(() => {}, 100);
try {
  assert.equal(await reportAsf(config, async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(signal.reason)))), false);
} finally { clearInterval(keepAlive); AbortSignal.timeout = originalTimeout; }
await rm(dir, { recursive: true, force: true });
console.log("ASF reporter self-check passed");
