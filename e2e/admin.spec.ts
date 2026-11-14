import { createClient } from "@libsql/client";
import { createHash } from "node:crypto";
import { test, expect } from "./test";

test("owner status stays private and displays bounded reports without identity", async ({ page, context }, testInfo) => {
  const client = createClient({ url: "file:.work/feed-e2e.db" });
  try {
    await context.clearCookies();
    const anonymous = await page.request.get("/admin");
    expect(anonymous.status()).toBe(404);
    expect(await anonymous.text()).not.toContain("Owner status");
    expect(anonymous.headers()["content-security-policy"]).toContain("nonce-");
    expect((await page.request.get("/admin/")).status()).toBe(404);
    expect((await page.goto("/admin"))?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Owner status" })).toHaveCount(0);
    await context.addCookies([{ name: "__Host-snag_sid", value: "e2e-session-only", domain: "localhost", path: "/", secure: true, httpOnly: true }]);
    const reader = await page.goto("/admin");
    expect(reader?.status()).toBe(404);
    expect(await reader?.text()).not.toContain("Owner status");
    await expect(page.getByRole("heading", { name: "404", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Owner status" })).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath("non-owner.png"), fullPage: true });
    await client.execute("INSERT INTO users(id) VALUES('owner-fixture')");
    await client.execute("INSERT INTO identities(provider,subject,user_id) VALUES('steam','76561198000000000','owner-fixture')");
    await client.execute({ sql: "INSERT INTO sessions VALUES(?,'owner-fixture',?,?)", args: [createHash("sha256").update("owner-session-fixture").digest("hex"), Date.now(), Date.now() + 60000] });
    await context.addCookies([{ name: "__Host-snag_sid", value: "owner-session-fixture", domain: "localhost", path: "/", secure: true, httpOnly: true }]);
    expect((await page.goto("/admin"))?.status()).toBe(200);
    await expect(page.getByText("No report received.", { exact: false })).toBeVisible();
    await client.execute({ sql: "INSERT INTO asf_reports(received_at,payload) VALUES(?,?)", args: [Date.now() - 16 * 60000, JSON.stringify({ online: true, history: "unavailable" })] });
    await page.reload();
    await expect(page.getByText("Bot at last report: Online")).toBeVisible();
    await expect(page.getByText("Report is stale.", { exact: false })).toBeVisible();
    await expect(page.getByText("No claim history reported yet.")).toBeVisible();
    await client.execute("DELETE FROM asf_reports");
    await client.execute({ sql: "INSERT INTO asf_reports(received_at,payload) VALUES(?,?)", args: [Date.now(), JSON.stringify({ online: true, history: [{ at: "2026-11-13T03:21:59.000Z", kind: "sub", id: 12345, result: "OK/NoDetail" }, { at: "2026-11-13T03:20:00.000Z", kind: "app", id: 440, result: "AccessDenied/InvalidPackage" }] })] });
    await page.reload();
    const claims = page.getByRole("region", { name: "Last free license claims" }).getByRole("listitem");
    await expect(claims).toHaveCount(2);
    await expect(claims.first()).toContainText("Success (OK/NoDetail)");
    await expect(page.getByRole("link", { name: "sub 12345" })).toHaveAttribute("href", "https://store.steampowered.com/sub/12345/");
    await expect(page.getByRole("link", { name: "app 440" })).toHaveAttribute("rel", "noreferrer");
    await expect(claims.nth(1)).toContainText("Failed (AccessDenied/InvalidPackage)");
    await expect(page.getByText("From ASF FreePackages log; covers claims since reporter start.")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("76561198000000000");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath("owner.png"), fullPage: true });
    await page.getByRole("link", { name: "Back to feed" }).click();
    await expect(page).toHaveURL(/\/feed$/);
  } finally {
    await client.execute("DELETE FROM asf_reports");
    await client.execute("DELETE FROM users WHERE id='owner-fixture'");
    client.close();
  }
});
