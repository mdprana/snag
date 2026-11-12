import { defineConfig } from "@playwright/test";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as webpush from "web-push";

const database = createClient({ url: "file:.work/feed-e2e.db" });
await database.executeMultiple("DROP TABLE IF EXISTS deliveries; DROP TABLE IF EXISTS notifications; DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS push_subs; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS identities; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS games; DROP TABLE IF EXISTS auth_flows; DROP TABLE IF EXISTS openid_nonces; DROP TABLE IF EXISTS rate_limits; DROP TABLE IF EXISTS asf_reports; DROP TABLE IF EXISTS poll_runs;");
await database.executeMultiple(readFileSync("db/migrations/001_init.sql", "utf8") + readFileSync("db/migrations/002_poll_runs.sql", "utf8"));
const now = Date.now();
await database.execute("INSERT INTO users(id) VALUES('reader')");
await database.execute({ sql: "INSERT INTO sessions VALUES(?, 'reader', ?, ?)", args: [createHash("sha256").update("e2e-session-only").digest("hex"), now, now + 86400000] });
for (const [id, kind, upcoming] of [["active", "free_to_keep", 0], ["next", "free_to_keep", 1], ["key", "key_giveaway", 0]] as const) {
  await database.execute({ sql: "INSERT INTO games VALUES(?, 'epic', ?, ?, ?, ?, ?, '', ?, ?, ?, ?)", args: [id, id, kind, `Game ${id}`, `https://store.epicgames.com/en-US/p/${id}`, `https://store.epicgames.com/purchase?offers=${id}`, upcoming ? now + 86400000 : now - 1000, now + 3 * 86400000, upcoming, now] });
}
await database.execute({ sql: "INSERT INTO poll_runs(source,ok,at) VALUES('epic',1,?)", args: [now - 91 * 60000] });
database.close();
const keys = webpush.generateVAPIDKeys();
export default defineConfig({
  testDir: "./e2e",
  outputDir: ".work/playwright-results",
  workers: 1,
  use: { baseURL: "https://localhost:3100", viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true },
  webServer: {
    command: "npm run dev",
    url: "https://localhost:3100/feed",
    ignoreHTTPSErrors: true,
    timeout: 120000,
    env: { APP_URL: "https://localhost:3100", DATABASE_URL: "file:.work/feed-e2e.db", NEXT_PUBLIC_VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:test@example.com", CRON_SECRET: "fake-cron-secret-for-e2e-only-000000" },
  },
});
