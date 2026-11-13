import { expect, test } from "@playwright/test";

for (const width of [320, 390]) {
  test.describe(`public prose at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    for (const path of ["/self-host", "/privacy"]) {
      test(`${path} contains horizontal scrolling`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("h1")).toBeVisible();
        const geometry = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
        for (const element of await page.locator(".public-prose h1, .public-prose p, .public-prose h2, .public-prose pre, .public-prose a").all()) {
          const box = await element.boundingBox();
          expect(box!.x).toBeGreaterThanOrEqual(0);
          expect(box!.x + box!.width).toBeLessThanOrEqual(width);
        }
        for (const link of await page.locator("h2 a").all()) {
          expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
          await link.click();
          await expect(page).toHaveURL(new RegExp(`${await link.getAttribute("href")}$`));
        }
        for (const pre of await page.locator("pre").all()) {
          await expect(pre).toHaveAttribute("tabindex", "0");
          await expect(pre).toHaveCSS("overflow-x", "auto");
          await expect(pre).toHaveCSS("white-space", "pre");
          await expect(pre).toHaveCSS("font-size", "13px");
          await expect(pre).toHaveCSS("padding", "14px");
          const scroll = await pre.evaluate((element) => {
            element.scrollLeft = element.scrollWidth;
            return { needed: element.scrollWidth > element.clientWidth, actual: element.scrollLeft };
          });
          if (scroll.needed) expect(scroll.actual).toBeGreaterThan(0);
        }
        if (path === "/self-host") {
          const compose = page.locator("pre").filter({ hasText: "services:" });
          expect(await compose.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
          await compose.evaluate((element) => { element.scrollLeft = 0; });
          await compose.focus();
          await page.keyboard.press("ArrowRight");
          await expect.poll(() => compose.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        }
      });
    }
  });
}
