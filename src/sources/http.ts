import { SourceError } from "./epic.ts";

export async function sourceJson(url: string, fetchFn: typeof fetch, signal = AbortSignal.timeout(15000)): Promise<unknown> {
  const response = await fetchFn(url, { signal, cache: "no-store", redirect: "error", ...(url.startsWith("https://www.wikidata.org/") ? { headers: { "User-Agent": "Snag/0.1 (public game metadata enrichment; free-games-hub)" } } : {}) });
  if (!response.ok || response.redirected) throw new SourceError(`Source HTTP ${response.status}`);
  if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") throw new SourceError("Source response is not JSON");
  const reader = response.body?.getReader();
  if (!reader) throw new SourceError("Missing source body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) throw new SourceError("Source body too large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
}
