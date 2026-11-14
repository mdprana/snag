import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import next from "next";

const originalFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (["cdn1.epicgames.com", "shared.fastly.steamstatic.com", "shared.akamai.steamstatic.com"].includes(url.hostname) && url.pathname.startsWith("/fixture/")) {
    return Promise.resolve(new Response(readFileSync(`e2e/fixtures/${url.pathname.includes("copperline") ? "cover-b" : "cover-a"}.png`), { headers: { "content-type": "image/png" } }));
  }
  return originalFetch(input, options);
};

const app = next({ dev: false, hostname: "localhost", port: 3100 });
await app.prepare();
const handler = app.getRequestHandler();
const server = createServer({ key: readFileSync("certificates/localhost-key.pem"), cert: readFileSync("certificates/localhost.pem") }, (incoming, outgoing) => {
  incoming.headers["x-forwarded-proto"] = "https";
  return handler(incoming, outgoing);
});
server.listen(3100);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.close(); void app.close().then(() => process.exit(0)); });
