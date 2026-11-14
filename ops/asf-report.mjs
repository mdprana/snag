import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const RESULT = /^[A-Za-z]{1,40}\/[A-Za-z]{1,40}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const valid = (e) => e && typeof e === "object" && Object.keys(e).length === 4 && typeof e.at === "string" && ISO.test(e.at) && (e.kind === "sub" || e.kind === "app") && Number.isInteger(e.id) && e.id >= 1 && e.id <= 4294967295 && typeof e.result === "string" && RESULT.test(e.result);

export function parseHistory(lines, bot) {
  const line = new RegExp(`^(\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2})\\|[^|]*\\|[A-Z]+\\|${bot}\\|ClaimFree(Sub|App)\\(\\) ID: (sub|app)/(\\d{1,10}) \\| Status: ([A-Za-z]{1,40})/([A-Za-z]{1,40})$`);
  const entries = [];
  for (const text of Array.isArray(lines) ? lines : []) {
    const m = typeof text === "string" && line.exec(text);
    if (!m || m[2].toLowerCase() !== m[3]) continue;
    const time = new Date(m[1].replace(" ", "T"));
    const entry = { at: Number.isNaN(time.getTime()) ? "" : time.toISOString(), kind: m[3], id: Number(m[4]), result: `${m[5]}/${m[6]}` };
    if (valid(entry)) entries.push(entry);
  }
  return entries;
}

export function mergeHistory(...lists) {
  const seen = new Map();
  for (const e of lists.flat()) if (valid(e)) seen.set(`${e.at}|${e.kind}|${e.id}|${e.result}`, { at: e.at, kind: e.kind, id: e.id, result: e.result });
  return [...seen.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)).slice(0, 20);
}

async function readJson(response) {
  if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) throw new Error();
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1024 * 1024) throw new Error();
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
}

export async function reportAsf(config, fetchFn = fetch) {
  try {
    const ipc = new URL(config.ASF_IPC_URL ?? "http://127.0.0.1:1242");
    const app = new URL(config.APP_URL);
    if (!["http:", "https:"].includes(ipc.protocol) || !["127.0.0.1", "[::1]"].includes(ipc.hostname) || ipc.pathname !== "/" || ipc.search || ipc.hash || ipc.username || ipc.password) throw new Error();
    if (app.protocol !== "https:" || app.origin !== config.APP_URL || app.username || app.password) throw new Error();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.ASF_BOT ?? "") || !config.ASF_IPC_PASSWORD || config.ASF_IPC_PASSWORD.length < 32 || !config.ASF_REPORT_SECRET || config.ASF_REPORT_SECRET.length < 32) throw new Error();
    const statePath = config.ASF_REPORT_STATE || join(config.HOME ?? "", ".local/state/snag/asf-history.json");
    if (!config.ASF_REPORT_STATE && !config.HOME) throw new Error();
    const ipcOptions = () => ({ headers: { Authentication: config.ASF_IPC_PASSWORD }, redirect: "error", signal: AbortSignal.timeout(10_000) });
    const raw = await readJson(await fetchFn(new URL(`/Api/Bot/${encodeURIComponent(config.ASF_BOT)}`, ipc), ipcOptions()));
    const online = raw?.Result?.[config.ASF_BOT]?.IsConnectedAndLoggedOn;
    if (raw?.Success !== true || typeof online !== "boolean") throw new Error();
    let stored = null;
    try { const parsed = JSON.parse(await readFile(statePath, "utf8")); stored = Array.isArray(parsed) ? mergeHistory(parsed) : null; } catch { stored = null; }
    let fresh = null;
    try {
      const log = await readJson(await fetchFn(new URL("/Api/NLog/File?count=500", ipc), ipcOptions()));
      if (log?.Success !== true || !Array.isArray(log?.Result?.Content)) throw new Error();
      fresh = parseHistory(log.Result.Content, config.ASF_BOT);
    } catch { fresh = null; }
    let history = stored ?? "unavailable";
    if (fresh) {
      history = mergeHistory(stored ?? [], fresh);
      await mkdir(dirname(statePath), { recursive: true, mode: 0o700 });
      await chmod(dirname(statePath), 0o700);
      await writeFile(`${statePath}.tmp`, JSON.stringify(history), { mode: 0o600 });
      await chmod(`${statePath}.tmp`, 0o600);
      await rename(`${statePath}.tmp`, statePath);
    }
    const sent = await fetchFn(new URL("/api/admin/asf-report", app), { method: "POST", headers: { authorization: `Bearer ${config.ASF_REPORT_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ online, history }), redirect: "error", signal: AbortSignal.timeout(10_000) });
    await sent.body?.cancel();
    if (!sent.ok) throw new Error();
    return true;
  } catch { return false; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!await reportAsf(process.env)) {
    console.error("ASF report failed; check local configuration, IPC, state file and report intake.");
    process.exitCode = 1;
  }
}
