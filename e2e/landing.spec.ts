import { expect, test } from "./test";
import { createClient } from "@libsql/client";

test("detail hero image loads and About content clears fixed claim bar on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/g/steam-active");
  const heroImage = page.locator(".detail-art img[data-testid=game-art-image]");
  await expect(heroImage).toHaveJSProperty("complete", true);
  expect(await heroImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await page.goto("/g/steam-active");
  await page.locator(".detail-meta").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  const geometry = await page.evaluate(() => {
    const meta = document.querySelector<HTMLElement>(".detail-meta")!;
    const bar = document.querySelector<HTMLElement>(".detail-bar")!;
    const text = document.querySelector<HTMLElement>(".about-text")!;
    const features = [...document.querySelectorAll<HTMLElement>(".detail-meta h2, .gallery")].at(-1);
    const barTop = bar.getBoundingClientRect().top;
    return {
      contentBottom: Math.max(text.getBoundingClientRect().bottom, features?.getBoundingClientRect().bottom ?? 0),
      barTop,
      reserved: parseFloat(getComputedStyle(document.querySelector("main")!).paddingBottom),
      noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
      metaInsideDetail: Boolean(meta.closest(".detail")),
    };
  });
  expect(geometry.noHorizontalOverflow).toBe(true);
  expect(geometry.metaInsideDetail).toBe(true);
  expect(geometry.contentBottom).toBeLessThanOrEqual(geometry.barTop);
  console.log(JSON.stringify({ naturalWidth: await heroImage.evaluate((image: HTMLImageElement) => image.naturalWidth), ...geometry }));
  expect(geometry.reserved).toBeGreaterThan(0);
});

test("repair 3 screenshots capture loaded states", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator(".hero").screenshot({ path: ".work/screenshots/repair3-home-390.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.screenshot({ path: ".work/screenshots/repair3-home-1440.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/g/steam-active");
  await expect(page.locator(".detail-art img[data-testid=game-art-image]")).toHaveJSProperty("complete", true);
  await page.locator(".detail-art").screenshot({ path: ".work/screenshots/repair3-detail-top-390.png" });
  await page.locator(".detail-meta").scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.screenshot({ path: ".work/screenshots/repair3-detail-about-390.png" });
});

test("compatibility logos appear only in About Platforms metadata", async ({ page }, testInfo) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  for (const path of ["/", "/feed"]) {
    await page.goto(path);
    await expect(page.locator('[aria-label="Platforms"]')).toHaveCount(0);
    await expect(page.locator('.game-row').first()).toBeVisible();
  }
  await page.goto("/g/steam-active");
  await expect(page.locator('.detail-head [aria-label="Platforms"]')).toHaveCount(0);
  const platforms = page.locator('.metadata-list > div').filter({ has: page.locator('dt', { hasText: /^Platforms$/ }) });
  await expect(platforms.locator('[aria-label="Platforms"]')).toHaveCount(1);
  for (const name of ["Windows", "macOS", "Linux"]) await expect(platforms.getByRole("button", { name, exact: true })).toBeVisible();
  await expect(page.locator('[aria-label="Platforms"]')).toHaveCount(1);
  const store = page.locator('.detail-head').getByRole("button", { name: "Steam store", exact: true });
  await expect(store).toBeVisible();
  for (const button of [store, ...await platforms.getByRole("button").all()]) {
    await button.focus();
    const tooltip = page.locator(`[id="${await button.getAttribute("aria-describedby")}"]`);
    await expect(tooltip).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tooltip).toBeHidden();
  }
  await platforms.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: ".work/screenshots/platform-placement-390.png", fullPage: true });
  await testInfo.attach("console-errors", { body: JSON.stringify(consoleErrors, null, 2), contentType: "application/json" });
  expect(errors).toEqual([]);
});

test("production CSP stays clean through slides, reveals, tooltips and gallery", async ({ page }, testInfo) => {
  test.skip(process.env.PLAYWRIGHT_PRODUCTION !== "1", "Next devtools injects styles without nonces; verify shipped production runtime.");
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const violations: string[] = [];
  await page.exposeFunction("recordCspViolation", (value: string) => violations.push(value));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", event => {
    (window as unknown as { recordCspViolation: (value: string) => void }).recordCspViolation(`${event.effectiveDirective}: ${event.blockedURI} ${event.sourceFile}:${event.lineNumber}`);
  }));
  await page.goto("/");
  await page.getByRole("button", { name: "Next game" }).click();
  await expect(page.locator(".cover-title")).toHaveText("Copperline Rally");
  await page.getByRole("button", { name: "Previous game" }).click();
  await expect(page.locator(".cover-title")).toHaveText("Lantern Harbor");
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate(top => scrollTo(0, top), y);
    await page.waitForTimeout(150);
  }
  await expect(page.locator(".reveal-item")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Hollow Orchard", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up notifications" })).toBeVisible();
  expect(await page.locator(".section").first().evaluate(element => getComputedStyle(element).backgroundImage)).toBe("none");
  await expect(page.locator(".site-footer")).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".game-row").first()).toHaveCSS("border-bottom-width", "1px");
  await page.goto("/g/steam-active");
  const platform = page.locator(".metadata-list").getByRole("button", { name: "Windows", exact: true });
  await platform.focus();
  const tooltip = page.locator(`[id="${await platform.getAttribute("aria-describedby")}"]`);
  await expect(tooltip).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tooltip).toBeHidden();
  await page.getByRole("button", { name: "Open screenshot 1", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Screenshot viewer" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Previous", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Trailer player" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Screenshot viewer" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.waitForTimeout(500);
  await testInfo.attach("production-csp", { body: JSON.stringify({ violations, errors }, null, 2), contentType: "application/json" });
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

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

test("landing hero shows fixture artwork, title above labelled countdown, and claim timing", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(() => { const box = document.querySelector("nextjs-portal")?.getBoundingClientRect(); return box ? box.width * box.height : 0; })).toBe(0);
  await expect(page.locator(".cover-stack .game-art").first()).toHaveJSProperty("complete", true);
  expect(await page.locator(".cover-stack .game-art").first().evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".hero-ending")).toContainText(/Lantern Harbor\s*Ends in\s*\d/);
  await expect(page.locator(".hero-empty-art")).toHaveCount(0);
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
    await expect(page.locator(".cover")).toHaveCount(1);
    const front = page.locator(".cover").first();
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
        distinctArt: element.parentElement!.querySelectorAll(".game-art").length === 1,
      };
    });
    expect(grouping).toEqual({ artOwned: true, titleOwned: true, noOverlap: true, titleFits: true, distinctArt: true });
    await page.getByRole("button", { name: "Next game" }).click();
    const backTitle = page.locator(".cover-title");
    await expect(backTitle).toHaveText("Copperline Rally");
    expect(await backTitle.evaluate(element => {
      const box = element.getBoundingClientRect();
      return document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)?.closest("a") === element.closest("a");
    })).toBe(true);
    const icon = page.locator(".cover-labels button").first();
    await expect(icon).toHaveCSS("width", "44px");
    await expect(icon.locator("svg")).toHaveCSS("width", "24px");
    await expect(page.getByRole("link", { name: "Set up notifications" })).toHaveClass(/btn-ghost/);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const title = page.locator(".cover-title").first();
    await expect(title).toBeVisible();
    expect(await title.evaluate(element => element.scrollWidth <= element.clientWidth && element.scrollHeight <= element.parentElement!.clientHeight)).toBe(true);
  });
}

test("manual covers clamp boundaries, sync navigation, swipe and reduced motion", async ({ page }) => {
  await page.goto("/");
  const stage = page.getByRole("region", { name: "Featured games" });
  const previous = stage.getByRole("button", { name: "Previous game" });
  const next = stage.getByRole("button", { name: "Next game" });
  await expect(previous).toBeDisabled();
  await expect(stage).toContainText("1 / 2");
  await next.click();
  await expect(next).toBeDisabled();
  await expect(stage.locator("a")).toHaveAttribute("href", "/g/steam-active");
  await expect(stage).toContainText("2 / 2");
  await stage.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(stage.locator("a")).toHaveAttribute("href", "/g/active");
  await page.keyboard.press("ArrowLeft");
  await expect(previous).toBeDisabled();
  const swipe = async (x: number, y: number, cancel = false) => {
    await stage.dispatchEvent("pointerdown", { pointerId: 1, isPrimary: true, button: 0, clientX: 180, clientY: 180 });
    await stage.dispatchEvent(cancel ? "pointercancel" : "pointerup", { pointerId: 1, isPrimary: true, clientX: x, clientY: y });
  };
  await swipe(100, 185, true);
  await swipe(170, 80);
  await swipe(175, 180);
  await expect(previous).toBeDisabled();
  await swipe(100, 185);
  await expect(next).toBeDisabled();
  await stage.locator("a").dispatchEvent("click");
  await expect(page).toHaveURL(/\/$/);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await previous.click();
  expect(await stage.locator(".cover").evaluate(e => e.getAnimations({ subtree: true }).length)).toBe(0);
  await page.waitForTimeout(6500);
  await expect(stage).toContainText("1 / 2");
  await expect(stage.locator(".cover-link")).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await next.click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await stage.locator(".cover").evaluate(e => e.getAnimations().length)).toBe(0);
  await stage.dispatchEvent("keydown", { key: "ArrowLeft" });
  await expect(stage).toContainText("2 / 2");
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
  await page.getByRole("contentinfo").scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await stage.dispatchEvent("keydown", { key: "ArrowLeft" });
  await expect(stage).toContainText("2 / 2");
  await stage.scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  await previous.click();
  await next.click();
  await previous.click();
  await expect(stage).toContainText("1 / 2");
  for (const button of [previous, next]) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});

for (const width of [320, 390, 1440]) test(`document background grows without tiles at ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 844 });
  for (const path of ["/", "/g/steam-active", "/privacy"]) {
    await page.goto(path);
    expect(await page.evaluate(() => {
      const body = getComputedStyle(document.body);
      return document.body.getBoundingClientRect().height >= document.documentElement.scrollHeight - 1
        && document.documentElement.scrollWidth <= innerWidth
        && body.backgroundRepeat.split(",").every(value => value.trim() === "no-repeat")
        && body.backgroundSize.split(",").every(value => value.trim() === "100% 100%");
    })).toBe(true);
  }
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
  await expect(count).toHaveText("2");
  expect(await count.evaluate((element) => element.getAnimations().length)).toBe(0);
  for (const element of await page.locator(".cover, .cover-stack, .cover-float").all()) await expect(element).toHaveCSS("transform", "none");
});

test("self-host guide keeps services private and data persistent", async ({ page }) => {
  await page.goto("/self-host");
  const main = page.getByRole("main");
  for (const text of ["always-on", "FreePackages", "127.0.0.1:3300:3000", "/app/config", "/app/plugins", "/usr/app/config", "IPC", "Steam Guard", "docker compose down"]) await expect(main).toContainText(text);
});
