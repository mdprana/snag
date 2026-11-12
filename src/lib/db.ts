import { createClient, type Client } from "@libsql/client";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "./env.ts";
import { log } from "./log.ts";

let client: Client | undefined;

export function db(): Client {
  if (client) return client;
  client = createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
  // ponytail: one PRAGMA on one pooled connection; libsql builds default foreign_keys=1 on every connection anyway. Set concurrency:1 if a build ever defaults it off.
  client.execute("PRAGMA foreign_keys=ON").catch((e: unknown) => log("error", "pragma foreign_keys failed", { error: String(e) }));
  return client;
}

export async function migrate(c: Client, dir = join(process.cwd(), "db/migrations")): Promise<string[]> {
  await c.execute("CREATE TABLE IF NOT EXISTS _migrations(name TEXT PRIMARY KEY, applied_at INT)");
  const done = new Set((await c.execute("SELECT name FROM _migrations")).rows.map((r) => String(r.name)));
  const applied: string[] = [];
  for (const name of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(name)) continue;
    const tx = await c.transaction("write");
    try {
      await tx.executeMultiple(readFileSync(join(dir, name), "utf8"));
      await tx.execute({ sql: "INSERT INTO _migrations(name, applied_at) VALUES(?, ?)", args: [name, Date.now()] });
      await tx.commit();
    } finally {
      tx.close();
    }
    applied.push(name);
  }
  return applied;
}
