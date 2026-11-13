import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { createServer } from "node:https";
import { request } from "node:http";

const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3114"], { stdio: "inherit" });
const server = createServer({ key: readFileSync("certificates/localhost-key.pem"), cert: readFileSync("certificates/localhost.pem") }, (incoming, outgoing) => {
  const upstream = request({ hostname: "localhost", port: 3114, method: incoming.method, path: incoming.url, headers: { ...incoming.headers, "x-forwarded-proto": "https" } }, response => {
    outgoing.writeHead(response.statusCode ?? 502, response.headers);
    response.pipe(outgoing);
  });
  upstream.on("error", () => { outgoing.writeHead(502); outgoing.end(); });
  incoming.pipe(upstream);
});
server.listen(3113);
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { server.close(); child.kill(signal); });
child.on("exit", code => { server.close(); process.exit(code ?? 1); });
