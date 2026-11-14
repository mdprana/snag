import { pathToFileURL } from "node:url";

export async function reportAsf(config, fetchFn = fetch) {
  try {
    const ipc = new URL(config.ASF_IPC_URL ?? "http://127.0.0.1:1242");
    const app = new URL(config.APP_URL);
    if (!["http:", "https:"].includes(ipc.protocol) || !["127.0.0.1", "[::1]"].includes(ipc.hostname) || ipc.pathname !== "/" || ipc.search || ipc.hash || ipc.username || ipc.password) throw new Error();
    if (app.protocol !== "https:" || app.origin !== config.APP_URL || app.username || app.password) throw new Error();
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(config.ASF_BOT ?? "") || !config.ASF_IPC_PASSWORD || config.ASF_IPC_PASSWORD.length < 32 || !config.ASF_REPORT_SECRET || config.ASF_REPORT_SECRET.length < 32) throw new Error();
    const signal = AbortSignal.timeout(10_000);
    const response = await fetchFn(new URL(`/Api/Bot/${encodeURIComponent(config.ASF_BOT)}`, ipc), { headers: { Authentication: config.ASF_IPC_PASSWORD }, redirect: "error", signal });
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
    const raw = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    const online = raw?.Result?.[config.ASF_BOT]?.IsConnectedAndLoggedOn;
    if (raw?.Success !== true || typeof online !== "boolean") throw new Error();
    const sent = await fetchFn(new URL("/api/admin/asf-report", app), { method: "POST", headers: { authorization: `Bearer ${config.ASF_REPORT_SECRET}`, "content-type": "application/json" }, body: JSON.stringify({ online, history: "unavailable" }), redirect: "error", signal: AbortSignal.timeout(10_000) });
    await sent.body?.cancel();
    if (!sent.ok) throw new Error();
    return true;
  } catch { return false; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!await reportAsf(process.env)) {
    console.error("ASF report failed; check local configuration, IPC and report intake.");
    process.exitCode = 1;
  }
}
