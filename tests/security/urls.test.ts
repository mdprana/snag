import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { safeOutboundUrl, safeImageUrl, steamDeepLink } from "@/src/lib/urls";

describe("C6 safeOutboundUrl", () => {
  it.each([
    "javascript:alert(1)",
    "http://store.epicgames.com/p/x",
    "https://evil.com/",
    "https://store.epicgames.com.evil.com/p/x",
    "https://www.gamerpower.com/open/dwarven-realms-steam-key-giveaway",
    "https://user:pw@store.epicgames.com/",
    "https://store.epicgames.com:8443/",
    "steam://store/123",
    "not a url",
    "",
  ])("rejects %s", (u) => expect(safeOutboundUrl(u)).toBeNull());

  it.each([
    "https://store.epicgames.com/purchase?offers=1-ns-id",
    "https://store.steampowered.com/app/440/",
    "https://www.gamerpower.com/dwarven-realms-steam-key-giveaway",
    "https://gamerpower.com/x",
  ])("accepts %s", (u) => expect(safeOutboundUrl(u)).toBe(new URL(u).href));
});

describe("C6 safeImageUrl", () => {
  it.each([
    "https://cdn1.epicgames.com/a.jpg",
    "https://cdn2.unrealengine.com/a.png",
    "https://shared.fastly.steamstatic.com/a.jpg",
    "https://shared.akamai.steamstatic.com/a.jpg",
    "https://cdn.akamai.steamstatic.com/a.jpg",
    "https://www.gamerpower.com/offers/1/a.jpg",
  ])("accepts %s", (u) => expect(safeImageUrl(u)).toBe(u));

  it.each([
    "http://cdn1.epicgames.com/a.jpg",
    "https://evil.com/a.jpg",
    "https://cdn1.epicgames.com.evil.com/a.jpg",
    "https://0b8f2d4c-malformed-uuid/a.jpg",
    "javascript:alert(1)",
    "data:image/png;base64,AAAA",
  ])("rejects %s", (u) => expect(safeImageUrl(u)).toBeNull());
});

describe("C6 steamDeepLink", () => {
  it("builds from integer appid", () => expect(steamDeepLink(440)).toBe("steam://store/440"));
  it.each([1.5, -1, 0, NaN, Infinity, "440" as unknown as number])("throws on %s", (v) =>
    expect(() => steamDeepLink(v)).toThrow());
});

describe("C6 titles render as text", () => {
  it("title <img src=x onerror=alert(1)> renders escaped", () => {
    const html = renderToStaticMarkup(createElement("h1", null, "<img src=x onerror=alert(1)>"));
    expect(html).toBe("<h1>&lt;img src=x onerror=alert(1)&gt;</h1>");
  });
});
