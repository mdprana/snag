import { expect, test } from "./test";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: "__Host-snag_sid", value: "e2e-session-only", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/feed");
});
test("feed shows free now, coming next, key giveaways", async ({ page }) => {
  for (const title of ["Free now", "Coming next", "Key giveaways"]) await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  for (const title of ["Lantern Harbor", "Copperline Rally", "Hollow Orchard", "Starfall Cartographers: Expedition Edition Founder's Pack"]) await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(/^Game (active|next|key)$/)).toHaveCount(0);
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Coming next" }) }).getByRole("link", { name: /^Claim\b/ })).toHaveCount(0);
});
test("claim button href is checkout url", async ({ page }) => {
  await expect(page.locator("article").filter({ hasText: "Lantern Harbor" }).getByRole("link", { name: "Claim on Epic Games Store (opens in a new tab)", exact: true })).toHaveAttribute("href", "https://store.epicgames.com/purchase?offers=active");
});
test("mark claimed collapses row", async ({ page }) => {
  const row = page.locator("article").filter({ hasText: "Lantern Harbor" });
  await row.getByRole("button", { name: "Mark claimed" }).click();
  await expect(page.getByRole("link", { name: "Claimed: Lantern Harbor" })).toBeVisible();
  await expect(row.getByRole("link", { name: /^Claim\b/ })).toHaveCount(0);
  await row.getByRole("button", { name: "Claimed · Undo" }).click();
  await expect(row.getByRole("button", { name: "Mark claimed" })).toBeVisible();
});
test("stale banner states last successful check time", async ({ page }) => {
  const status = page.getByRole("status");
   await expect(status).toContainText("Availability may be outdated. Last checked");
  await expect(status.locator("time")).toHaveAttribute("datetime", /^\d{4}-\d{2}-\d{2}T/);
  await expect(status).not.toContainText(" or ");
});
test("mark claimed aligns across row types", async ({ page }) => {
  const buttons = page.getByRole("button", { name: "Mark claimed" });
  await expect(buttons).toHaveCount(3);
  const lefts = await Promise.all((await buttons.all()).map(async (button) => Math.round((await button.boundingBox())!.x)));
  expect(new Set(lefts).size).toBe(1);
});
test("key giveaway CTA does not squeeze title at 390px", async ({ page }) => {
  const row = page.locator("article").filter({ hasText: "Starfall Cartographers" });
  const cta = row.getByRole("link", { name: "Get key on GamerPower (opens in a new tab)" });
  expect(await cta.evaluate(element => element.firstChild?.textContent)).toBe("Get key");
  const title = (await row.getByRole("heading").boundingBox())!;
  expect(title.width).toBeGreaterThanOrEqual(200);
  expect((await cta.boundingBox())!.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
});
test("no dev overlay block at top-left", async ({ page }) => {
  expect(await page.evaluate(() => { const box = document.querySelector("nextjs-portal")?.getBoundingClientRect(); return box ? box.width * box.height : 0; })).toBe(0);
  const logo = (await page.getByRole("link", { name: "Snag" }).boundingBox())!;
  const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("a")?.getAttribute("href"), [logo.x + logo.width / 2, logo.y + logo.height / 2]);
  expect(hit).toBe("/");
});
