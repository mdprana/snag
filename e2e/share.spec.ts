import { writeFile } from "node:fs/promises";
import { expect, test } from "./test";

test("social cards expose metadata and render 1200x630 PNGs anonymously", async ({ request }) => {
  const home = await request.get("/");
  expect(home.status()).toBe(200);
  const html = await home.text();
  for (const tag of ['property="og:title"', 'property="og:description"', 'property="og:image"', 'name="twitter:card" content="summary_large_image"']) expect(html).toContain(tag);
  expect(html).toMatch(/property="og:image" content="https:\/\/localhost:3100\/opengraph-image/);
  for (const [url, output] of [["/opengraph-image", ".work/og-site.png"], ["/g/active/opengraph-image", ".work/og-game.png"]]) {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
    expect(response.headers()["cache-control"]).toContain("s-maxage=1800");
    const png = await response.body();
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
    await writeFile(output, png);
  }
  for (const url of ["/twitter-image", "/g/active/twitter-image", "/g/unknown/opengraph-image"]) {
    const response = await request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("image/png");
  }
  const game = await request.get("/g/active");
  expect(await game.text()).toContain('property="og:title" content="Lantern Harbor: Free to keep on Epic Games Store"');
});
