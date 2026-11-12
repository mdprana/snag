import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client";

test("landing count equals free games in DB", async ({ page }) => {
  const database = createClient({ url: "file:.work/feed-e2e.db" });
  const now = Date.now();
  const result = await database.execute({ sql: "SELECT COUNT(*) AS count FROM games WHERE kind = 'free_to_keep' AND upcoming = 0 AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)", args: [now, now] });
  database.close();
  await page.goto("/");
  await expect(page.getByTestId("free-count")).toHaveText(String(result.rows[0].count));
  await expect(page.getByRole("link", { name: "Game active", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Game next", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Game key", exact: true })).toHaveCount(0);
});

test("privacy lists stored data and delete instructions", async ({ page }) => {
  await page.goto("/privacy");
  for (const text of ["provider IDs", "display name", "push subscriptions", "claims", "timezone", "30 days", "24 hours", "1 hour", "Apple", "Google", "Mozilla"]) await expect(page.getByRole("main")).toContainText(text);
  await expect(page.getByRole("link", { name: "Account settings" })).toHaveAttribute("href", "/settings");
  await expect(page.getByRole("main")).toContainText('type "DELETE"');
});

test("reduced motion shows final count without animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const count = page.getByTestId("free-count");
  await expect(count).toHaveText("1");
  expect(await count.evaluate((element) => element.getAnimations().length)).toBe(0);
});

test("self-host guide keeps services private and data persistent", async ({ page }) => {
  await page.goto("/self-host");
  const main = page.getByRole("main");
  for (const text of ["always-on", "FreePackages", "127.0.0.1:3300:3000", "/app/config", "/app/plugins", "/usr/app/config", "IPC", "Steam Guard", "docker compose down"]) await expect(main).toContainText(text);
});
