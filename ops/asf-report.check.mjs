import assert from "node:assert/strict";
import { reportAsf } from "./asf-report.mjs";

const config = { ASF_IPC_URL: "http://127.0.0.1:1242", APP_URL: "https://snag.example.com", ASF_BOT: "bot", ASF_IPC_PASSWORD: "i".repeat(32), ASF_REPORT_SECRET: "s".repeat(32) };
let calls = [];
const fetchFn = async (url, options) => {
  calls.push([String(url), options]);
  assert.equal(options.redirect, "error");
  assert.ok(options.signal instanceof AbortSignal);
  return calls.length === 1 ? Response.json({ Success: true, Result: { bot: { IsConnectedAndLoggedOn: true, SteamID: "private", BotConfig: { token: "private" } } } }) : Response.json({ ok: true });
};
assert.equal(await reportAsf(config, fetchFn), true);
assert.equal(calls[0][0], "http://127.0.0.1:1242/Api/Bot/bot");
assert.deepEqual(JSON.parse(calls[1][1].body), { online: true, history: "unavailable" });
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
console.log("ASF reporter self-check passed");
