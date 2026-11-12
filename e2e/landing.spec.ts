import { expect, test } from "@playwright/test";
import { createClient } from "@libsql/client";

test("landing count equals free games in DB", async ({ page }) => {
  const database = createClient({ url: "file:.work/feed-e2e.db" });
  const now = Date.now();
  const result = await database.execute({ sql: "SELECT COUNT(*) AS count FROM games WHERE kind = 'free_to_keep' AND upcoming = 0 AND starts_at <= ? AND (ends_at IS NULL OR ends_at > ?)", args: [now, now] });
  database.close();
  await page.goto("/");
  await expect(page.getByTestId("free-count")).toHaveText(String(result.rows[0].count));
  await expect(page.getByRole("link", { name: "Lantern Harbor", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Hollow Orchard", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /Starfall Cartographers/ })).toHaveCount(0);
  await expect(page.getByText(/^Game (active|next|key)$/)).toHaveCount(0);
});

test("landing offer card shows intentional art, title, store and claim timing", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => { const box = document.querySelector("nextjs-portal")?.getBoundingClientRect(); return box ? box.width * box.height : 0; })).toBe(0);
  const card = page.getByRole("link", { name: "Lantern Harbor", exact: true });
  await expect(card.locator(".game-art-fallback")).toBeVisible();
  await expect(card.locator(".game-art-fallback")).toContainText("Epic");
  await expect(card.locator(".cover-title")).toHaveText("Lantern Harbor");
  await expect(page.locator(".cover-stack")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/free to keep/i);
  await expect(page.locator(".hero")).toContainText("Claim before");
  await expect(page.locator(".hero time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
});

for (const width of [390, 1440]) {
  test(`cover artwork and captions stay grouped at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.mouse.move(0, 0);
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1800);
    await expect(page.locator(".cover")).toHaveCount(2);
    const front = page.locator(".cover").first();
    await expect(front).toHaveCSS("z-index", "3");
    await expect(page.locator(".cover").nth(1)).toHaveCSS("z-index", "2");
    const grouping = await front.evaluate(element => {
      const link = element.querySelector("a")!;
      const art = link.querySelector<HTMLElement>(".game-art")!;
      const caption = link.querySelector<HTMLElement>(".cover-caption")!;
      const title = link.querySelector<HTMLElement>(".cover-title")!;
      const ownsPoint = (target: Element, x: number, y: number) => {
        const box = target.getBoundingClientRect();
        return document.elementFromPoint(box.x + box.width * x, box.y + box.height * y)?.closest("a") === link;
      };
      return {
        artOwned: [0.2, 0.5, 0.8].every(x => [0.2, 0.5, 0.8].every(y => ownsPoint(art, x, y))),
        titleOwned: ownsPoint(title, 0.5, 0.5),
        noOverlap: caption.offsetTop >= art.offsetTop + art.offsetHeight - 1,
        titleFits: title.scrollWidth <= title.clientWidth && title.scrollHeight <= caption.clientHeight,
        distinctArt: art.getBoundingClientRect().x !== element.parentElement!.querySelectorAll(".game-art")[1].getBoundingClientRect().x,
      };
    });
    expect(grouping).toEqual({ artOwned: true, titleOwned: true, noOverlap: true, titleFits: true, distinctArt: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const title = page.locator(".cover-title").first();
    await expect(title).toBeVisible();
    expect(await title.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.parentElement!.clientHeight)).toBe(true);
  });
}

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
  await expect(count).toHaveText("2");
  expect(await count.evaluate((element) => element.getAnimations().length)).toBe(0);
  for (const element of await page.locator(".cover, .cover-stack, .cover-float").all()) await expect(element).toHaveCSS("transform", "none");
});

test("self-host guide keeps services private and data persistent", async ({ page }) => {
  await page.goto("/self-host");
  const main = page.getByRole("main");
  for (const text of ["always-on", "FreePackages", "127.0.0.1:3300:3000", "/app/config", "/app/plugins", "/usr/app/config", "IPC", "Steam Guard", "docker compose down"]) await expect(main).toContainText(text);
});
