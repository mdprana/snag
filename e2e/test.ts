import { test as base } from "@playwright/test";

export const test = base.extend<{ fixtureArt: void }>({
  fixtureArt: [async ({ page }, use) => {
    await page.route("**/_next/image?**", route => {
      const source = new URL(route.request().url()).searchParams.get("url") ?? "";
      return route.fulfill({ path: `e2e/fixtures/${source.includes("copperline") ? "cover-b" : "cover-a"}.png`, contentType: "image/png" });
    });
    await use();
  }, { auto: true }],
});
export { expect } from "@playwright/test";
