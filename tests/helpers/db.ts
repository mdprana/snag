import { createClient, type Client } from "@libsql/client";
import { migrate } from "@/src/lib/db";

export async function testDb(): Promise<Client> {
  const c = createClient({ url: "file::memory:" });
  await c.execute("PRAGMA foreign_keys=ON");
  await migrate(c);
  return c;
}
