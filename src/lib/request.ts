const MAX_MUTATION_BODY = 64 * 1024;

export async function boundedBody(request: Request, maxBytes = MAX_MUTATION_BODY): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) return null;
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(body);
}

export async function boundedJson(request: Request): Promise<unknown | null> {
  const body = await boundedBody(request);
  if (body === null) return null;
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}
