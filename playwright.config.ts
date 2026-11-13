import { defineConfig } from "@playwright/test";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as webpush from "web-push";

const database = createClient({ url: "file:.work/feed-e2e.db" });
await database.executeMultiple("DROP TABLE IF EXISTS game_metadata; DROP TABLE IF EXISTS deliveries; DROP TABLE IF EXISTS notifications; DROP TABLE IF EXISTS claims; DROP TABLE IF EXISTS push_subs; DROP TABLE IF EXISTS sessions; DROP TABLE IF EXISTS identities; DROP TABLE IF EXISTS users; DROP TABLE IF EXISTS games; DROP TABLE IF EXISTS auth_flows; DROP TABLE IF EXISTS openid_nonces; DROP TABLE IF EXISTS rate_limits; DROP TABLE IF EXISTS asf_reports; DROP TABLE IF EXISTS poll_runs;");
await database.executeMultiple(readFileSync("db/migrations/001_init.sql", "utf8") + readFileSync("db/migrations/002_poll_runs.sql", "utf8") + readFileSync("db/migrations/003_game_metadata.sql", "utf8"));
const now = Date.now();
await database.execute("INSERT INTO users(id) VALUES('reader')");
await database.execute({ sql: "INSERT INTO sessions VALUES(?, 'reader', ?, ?)", args: [createHash("sha256").update("e2e-session-only").digest("hex"), now, now + 86400000] });
// Test-only fictional offers for local e2e and preview screenshots. Never seeded outside .work/feed-e2e.db.
// Image URLs use allowed hosts but are served from e2e/fixtures by the route mock in e2e/test.ts; empty image_url renders the placeholder.
const FIXTURE_GAMES = [
  ["active", "epic", "active", "free_to_keep", "Lantern Harbor", 0, "https://cdn1.epicgames.com/fixture/lantern-harbor.png"],
  ["steam-active", "steam", "2400100", "free_to_keep", "Copperline Rally", 0, "https://shared.fastly.steamstatic.com/fixture/copperline-rally.png"],
  ["next", "epic", "next", "free_to_keep", "Hollow Orchard", 1, ""],
  ["key", "epic", "key", "key_giveaway", "Starfall Cartographers: Expedition Edition Founder's Pack", 0, ""],
] as const;
for (const [id, store, externalId, kind, title, upcoming, image] of FIXTURE_GAMES) {
  const storeUrl = store === "steam" ? `https://store.steampowered.com/app/${externalId}/` : `https://store.epicgames.com/en-US/p/${id}`;
  const claimUrl = kind === "key_giveaway" ? `https://www.gamerpower.com/${id}` : store === "steam" ? storeUrl : `https://store.epicgames.com/purchase?offers=${id}`;
  await database.execute({ sql: "INSERT INTO games VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", args: [id, store, externalId, kind, title, storeUrl, claimUrl, image, upcoming ? now + 86400000 : now - 1000, now + 3 * 86400000, upcoming, now] });
}
// Test-only fictional metadata for the fictional Steam fixture.
await database.execute({ sql: "INSERT INTO game_metadata VALUES('steam-active','steam',NULL,?,?,?,NULL)", args: [JSON.stringify({ provider: "steam", sourceUrl: "https://store.steampowered.com/api/appdetails?appids=2400100&cc=id&l=en", fetchedAt: now, locale: "en", country: "ID", aboutText: "Fictional rally fixture used only for local tests.", aboutKind: "full", platforms: ["windows", "macos", "linux"], screenshots: [], developer: "Fixture Studio", publisher: "Fixture Publisher" }), now, now] });
for (const source of ["epic", "steam", "gamerpower"]) await database.execute({ sql: "INSERT INTO poll_runs(source,ok,at) VALUES(?,1,?)", args: [source, now - 91 * 60000] });
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
