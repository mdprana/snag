import { expect, test } from "@playwright/test";

for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 1000 }]) {
  test.describe(`${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport });
    for (const [name, path] of [["landing", "/"], ["feed", "/feed"], ["detail", "/g/active"]]) {
      test(`${name} fixture screenshot and keyboard access`, async ({ page, context }) => {
        await context.addCookies([{ name: "__Host-snag_sid", value: "e2e-session-only", domain: "localhost", path: "/", secure: true, httpOnly: true, sameSite: "Lax" }]);
        await page.route("https://**/*", async (route) => {
          if (new URL(route.request().url()).hostname === "localhost") await route.continue();
          else await route.abort();
        });
        await page.goto(path);
        await page.getByRole("heading", { level: 1 }).waitFor();
        if (name === "feed") await expect(page.locator(".entry-motion").first()).toHaveCSS("animation-duration", "0.5s");
        await page.emulateMedia({ reducedMotion: "reduce" });
        if (name === "feed") await expect(page.locator(".entry-motion").first()).toHaveCSS("animation-name", "none");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
        await page.screenshot({ path: `.work/screenshots/${name}-${viewport.width}x${viewport.height}.png`, fullPage: true, animations: "disabled" });
        if (name === "landing") return;
        const controls = page.locator("main").locator("a[href], button, input, select");
        for (const control of await controls.all()) {
          if (!await control.isVisible()) continue;
          const box = await control.boundingBox();
          expect(box!.width).toBeGreaterThanOrEqual(44);
          expect(box!.height, await control.evaluate((element) => `${element.outerHTML} ${getComputedStyle(element).minHeight}`)).toBeGreaterThanOrEqual(44);
        }
        await page.keyboard.press("Tab");
        for (let attempt = 0; attempt < 10 && !await page.locator("main :focus-visible").count(); attempt++) await page.keyboard.press("Tab");
        const focus = await page.locator(":focus-visible").evaluate((element) => {
          const style = getComputedStyle(element);
          return { width: style.outlineWidth, style: style.outlineStyle, color: style.outlineColor, offset: style.outlineOffset };
        });
        expect(focus).toEqual({ width: "2px", style: "solid", color: "rgb(255, 90, 60)", offset: "2px" });
      });
    }
  });
}
