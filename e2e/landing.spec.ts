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
  await expect(page.locator(".cover-controls")).toHaveCount(0);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 400) {
    await page.evaluate(top => scrollTo(0, top), y);
    await page.waitForTimeout(150);
  }
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  await expect(page.locator(".reveal-item")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Hollow Orchard", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Set up notifications" })).toBeVisible();
  expect(await page.locator(".section").first().evaluate(element => getComputedStyle(element).backgroundImage)).toBe("none");
  await expect(page.locator(".site-footer")).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".game-row").first()).toHaveCSS("border-bottom-width", "1px");
  const stage = page.locator(".cover-stage");
  const nextCover = stage.locator(".cover").nth(1);
  await nextCover.locator("a").focus();
  await expect(nextCover).toHaveCSS("z-index", "4");
  await nextCover.locator("a").blur();
  await page.mouse.move(0, 0);
  await expect(stage.locator(".cover").first()).toHaveCSS("z-index", "3");
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
    const front = page.locator(".cover").first();
    const grouping = await front.evaluate(element => {
      const link = element.querySelector<HTMLAnchorElement>(".cover-link")!;
      const art = link.querySelector<HTMLElement>(".game-art")!;
      const caption = link.querySelector<HTMLElement>(".cover-caption")!;
      const title = link.querySelector<HTMLElement>(".cover-title")!;
      return {
        artOwned: art.closest("a") === link,
        titleOwned: title.closest("a") === link,
        noOverlap: caption.getBoundingClientRect().top >= art.getBoundingClientRect().bottom - 1,
        titleFits: title.scrollWidth <= title.clientWidth && title.scrollHeight <= caption.clientHeight,
        distinctCards: element.parentElement!.querySelectorAll(".cover-fan").length === 2,
      };
    });
    expect(grouping).toEqual({ artOwned: true, titleOwned: true, noOverlap: true, titleFits: true, distinctCards: true });
    const nextCover = page.locator(".cover").nth(1);
    await nextCover.hover({ position: { x: 8, y: 8 }, force: true });
    const backTitle = nextCover.locator(".cover-title");
    await expect(backTitle).toHaveText("Copperline Rally");
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

type Box = { x: number; y: number; width: number; height: number };
const near = (a: Box, b: Box, tolerance: number) => (["x", "y", "width", "height"] as const).every(key => Math.abs(a[key] - b[key]) <= tolerance);
const fanBoxes = (page: import("@playwright/test").Page) => page.evaluate(async () => {
  await new Promise(resolve => setTimeout(resolve, 400));
  await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity).map(animation => animation.finished.catch(() => undefined)));
  const origin = document.querySelector(".cover-stack")!.getBoundingClientRect();
  return [...document.querySelectorAll<HTMLElement>(".cover")].map(cover => {
    const { x, y, width, height } = cover.querySelector(".cover-fan")!.getBoundingClientRect();
    return { x: x - origin.x, y: y - origin.y, width, height, z: Number(getComputedStyle(cover).zIndex) };
  });
});

for (const width of [390, 1440]) test(`hero fan promotes hovered or focused cover to the front and returns at ${width}px`, async ({ page }, testInfo) => {
  const violations: string[] = [];
  await page.exposeFunction("recordFanCsp", (value: string) => violations.push(value));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", event => (window as unknown as { recordFanCsp: (value: string) => void }).recordFanCsp(`${event.effectiveDirective}: ${event.blockedURI}`)));
  await page.setViewportSize({ width, height: 1000 });
  await page.mouse.move(0, 0);
  await page.goto("/");
  const stage = page.locator(".cover-stage");
  await expect(stage).toHaveAttribute("data-count", "2");
  await expect(stage.locator(".cover")).toHaveCount(2);
  await expect(page.getByRole("button", { name: /Previous|Next/ })).toHaveCount(0);
  await expect(stage.locator(".cover-controls")).toHaveCount(0);
  await expect(stage.locator("[style]:not(.cover-stage, .cover-float, .cover-fan)")).toHaveCount(0);
  await page.waitForTimeout(1000);
  const before = await fanBoxes(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const stageBox = (await stage.boundingBox())!;
  const clip = { x: Math.max(0, stageBox.x - 24), y: Math.max(0, stageBox.y - 24), width: Math.min(width - Math.max(0, stageBox.x - 24), stageBox.width + 48), height: stageBox.height + 48 };
  await page.screenshot({ path: `.work/screenshots/hero-fan-initial-${width}.png`, clip });
  const back = stage.locator(".cover").nth(1);
  const point = await back.evaluate(element => {
    const box = element.getBoundingClientRect();
    for (let y = box.top + 4; y < box.bottom; y += 2) for (let x = box.left + 4; x < box.right; x += 2) if (element.contains(document.elementFromPoint(x, y))) return { x, y };
    throw new Error("back cover not exposed");
  });
  await page.mouse.move(point.x, point.y);
  const samples: boolean[] = [];
  for (let i = 0; i < 10; i++) { samples.push(await back.evaluate(element => element.matches(":hover"))); await page.waitForTimeout(100); }
  expect(samples.every(Boolean)).toBe(true);
  const hovered = await fanBoxes(page);
  expect(near(hovered[1], before[0], 3)).toBe(true);
  expect(hovered[1].z).toBe(Math.max(...hovered.map(box => box.z)));
  expect(hovered[1].z).toBeGreaterThan(hovered[0].z);
  expect(near(hovered[0], before[1], 3)).toBe(true);
  await expect(back.locator(".cover-labels")).toBeVisible();
  await expect(stage.locator(".cover").first().locator(".cover-labels")).toBeHidden();
  await page.screenshot({ path: `.work/screenshots/hero-fan-hover-${width}.png`, clip });
  await page.mouse.move(0, 0);
  const after = await fanBoxes(page);
  for (const index of [0, 1]) expect(near(after[index], before[index], 2)).toBe(true);
  await back.locator("a").focus();
  const focused = await fanBoxes(page);
  expect(near(focused[1], before[0], 3)).toBe(true);
  expect(near(focused[0], before[1], 3)).toBe(true);
  await back.locator("a").blur();
  const blurred = await fanBoxes(page);
  for (const index of [0, 1]) expect(near(blurred[index], before[index], 2)).toBe(true);
  console.log(JSON.stringify({ width, before, hovered, after, focused, blurred, hoverSamples: samples }));
  await testInfo.attach("fan-boxes", { body: JSON.stringify({ before, hovered, after, focused, blurred }, null, 2), contentType: "application/json" });
  if (process.env.PLAYWRIGHT_PRODUCTION === "1") expect(violations).toEqual([]);
});

test("reduced motion hero fan swaps without sliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const before = await fanBoxes(page);
  await page.locator(".cover").nth(1).locator("a").focus();
  const focused = await fanBoxes(page);
  expect(focused[1].z).toBeGreaterThan(focused[0].z);
  for (const index of [0, 1]) expect(near(focused[index], before[index], 2)).toBe(true);
  expect(await page.locator(".cover-fan").first().evaluate(element => getComputedStyle(element).transitionDuration)).toBe("0s");
});

for (const width of [390, 1440]) test(`three-card hero hover, focus, reset and reduced motion at ${width}px`, async ({ page }, testInfo) => {
  const database = createClient({ url: "file:.work/feed-e2e.db" });
  const violations: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.exposeFunction("recordThreeCsp", (value: string) => violations.push(value));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", event => {
    (window as unknown as { recordThreeCsp: (value: string) => void }).recordThreeCsp(`${event.effectiveDirective}: ${event.blockedURI}`);
  }));
  const now = Date.now();
  await database.execute({
    sql: "INSERT INTO games VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    args: ["three-card-only", "epic", "three-card-only", "free_to_keep", "Third card test fixture", "https://store.epicgames.com/en-US/p/three-card-only", "https://store.epicgames.com/en-US/p/three-card-only", "https://cdn1.epicgames.com/fixture/third.png", now - 1000, now + 4 * 86400000, 0, now],
  });
  try {
    await page.setViewportSize({ width, height: 1000 });
    await page.mouse.move(0, 0);
    await page.goto("/");
    const stage = page.locator(".cover-stage");
    const covers = stage.locator(".cover");
    await expect(stage).toHaveAttribute("data-count", "3");
    await expect(covers).toHaveCount(3);
    await expect(covers.nth(2).locator("a")).toHaveAccessibleName("Third card test fixture");
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(1800);
    const initial = await fanBoxes(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const third = covers.nth(2);
    const point = await third.evaluate(element => {
      const box = element.getBoundingClientRect();
      for (let y = Math.max(0, box.top + 4); y < Math.min(innerHeight, box.bottom); y += 2) {
        for (let x = Math.max(0, box.left + 4); x < Math.min(innerWidth, box.right); x += 2) {
          if (element.contains(document.elementFromPoint(x, y))) return { x, y };
        }
      }
      throw new Error("third cover has no exposed hit area");
    });
    await page.mouse.move(point.x, point.y);
    for (let sample = 0; sample < 10; sample++) {
      expect(await third.evaluate(element => element.matches(":hover"))).toBe(true);
      await page.waitForTimeout(100);
    }
    const promoted = await fanBoxes(page);
    expect(near(promoted[2], initial[0], 3)).toBe(true);
    expect(promoted[2].z).toBeGreaterThan(Math.max(promoted[0].z, promoted[1].z));
    await expect(third.locator(".cover-labels")).toBeVisible();
    await expect(covers.first().locator(".cover-labels")).toBeHidden();
    await page.mouse.move(0, 0);
    const reset = await fanBoxes(page);
    for (const index of [0, 1, 2]) expect(near(reset[index], initial[index], 2)).toBe(true);
    await expect(stage).not.toHaveAttribute("style", /--tilt/);
    await third.locator("a").focus();
    await expect(third.locator("a")).toBeFocused();
    const focused = await fanBoxes(page);
    expect(near(focused[2], initial[0], 3)).toBe(true);
    expect(focused[2].z).toBeGreaterThan(Math.max(focused[0].z, focused[1].z));
    await third.locator("a").blur();
    const blurred = await fanBoxes(page);
    for (const index of [0, 1, 2]) expect(near(blurred[index], initial[index], 2)).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    const reducedInitial = await fanBoxes(page);
    await page.mouse.move(point.x, point.y);
    expect(await third.evaluate(element => element.matches(":hover"))).toBe(true);
    const reducedHovered = await fanBoxes(page);
    expect(reducedHovered[2].z).toBeGreaterThan(Math.max(reducedHovered[0].z, reducedHovered[1].z));
    for (const index of [0, 1, 2]) expect(near(reducedHovered[index], reducedInitial[index], 2)).toBe(true);
    await page.mouse.move(0, 0);
    await third.locator("a").focus();
    const reducedFocused = await fanBoxes(page);
    expect(reducedFocused[2].z).toBeGreaterThan(Math.max(reducedFocused[0].z, reducedFocused[1].z));
    for (const index of [0, 1, 2]) {
      expect(near(reducedFocused[index], reducedInitial[index], 2)).toBe(true);
      await expect(covers.nth(index).locator(".cover-fan")).toHaveCSS("transition-duration", "0s");
    }
    await third.locator("a").blur();
    const reducedReset = await fanBoxes(page);
    for (const index of [0, 1, 2]) expect(near(reducedReset[index], reducedInitial[index], 2)).toBe(true);
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
    await testInfo.attach("three-card-evidence", { body: JSON.stringify({ width, initial, promoted, reset, focused, blurred, reducedInitial, reducedFocused, reducedReset, violations, errors }), contentType: "application/json" });
    console.log(JSON.stringify({ width, cards: 3, cspEvents: violations.length, errors }));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await fanBoxes(page);
    await stage.screenshot({ path: `.work/screenshots/reconcile-three-initial-${width}.png` });
    await third.locator("a").focus();
    await fanBoxes(page);
    await stage.screenshot({ path: `.work/screenshots/reconcile-three-promoted-${width}.png` });
    await third.locator("a").blur();
    await page.mouse.move(0, 0);
    await fanBoxes(page);
    await stage.screenshot({ path: `.work/screenshots/reconcile-three-reset-${width}.png` });
    expect(violations).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await database.execute("DELETE FROM games WHERE id = 'three-card-only'");
    database.close();
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
