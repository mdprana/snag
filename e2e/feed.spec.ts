import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([{ name: "__Host-snag_sid", value: "e2e-session-only", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
  await page.goto("/feed");
});
test("feed shows free now, coming next, key giveaways", async ({ page }) => {
  for (const title of ["Free now", "Coming next", "Key giveaways"]) await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible();
  await expect(page.getByText("Game active", { exact: true })).toBeVisible();
  await expect(page.getByText("Game next", { exact: true })).toBeVisible();
  await expect(page.getByText("Game key", { exact: true })).toBeVisible();
  await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Coming next" }) }).getByRole("link", { name: "Claim", exact: true })).toHaveCount(0);
});
test("claim button href is checkout url", async ({ page }) => {
  await expect(page.getByRole("link", { name: "Claim", exact: true })).toHaveAttribute("href", "https://store.epicgames.com/purchase?offers=active");
});
test("mark claimed collapses row", async ({ page }) => {
  const row = page.locator("article").filter({ hasText: "Game active" });
  await row.getByRole("button", { name: "Mark claimed" }).click();
  await expect(page.getByRole("link", { name: "Claimed: Game active" })).toBeVisible();
  await expect(row.getByRole("link", { name: "Claim", exact: true })).toHaveCount(0);
  await row.getByRole("button", { name: "Claimed · Undo" }).click();
});
test("stale banner when last poll > 90 min", async ({ page }) => {
  await expect(page.getByRole("status")).toContainText("Updates delayed");
});
