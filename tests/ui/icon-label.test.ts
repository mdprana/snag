import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { IconLabel, tooltipNext } from "@/src/components/IconLabel";
import { PlatformLabels, StoreBadge } from "@/src/components/StoreBadge";
import { testDb } from "../helpers/db";
import { getGame, listArchive, listFeed, type FeedGame } from "@/src/lib/games";
import { GameRow } from "@/src/components/GameRow";
import { CoverStack } from "@/src/components/CoverStack";
import { parseSteamMetadata, saveMetadata } from "@/src/lib/metadata";

vi.mock("@/src/components/ClaimButton", () => ({ ClaimButton: () => null }));

it("tooltip opens on hover/focus/tap, Escape and blur/leave hide it", () => {
  expect(tooltipNext(false, "enter")).toBe(true);
  expect(tooltipNext(false, "focus")).toBe(true);
  expect(tooltipNext(false, "click")).toBe(true);
  expect(tooltipNext(true, "click")).toBe(false);
  expect(tooltipNext(true, "escape")).toBe(false);
  expect(tooltipNext(true, "blur")).toBe(false);
  expect(tooltipNext(true, "leave")).toBe(false);
});

it("icon-only labels name the button, describe via tooltip and never use title", () => {
  const steam = renderToStaticMarkup(createElement(StoreBadge, { store: "steam" }));
  expect(steam).toMatch(/<button type="button" aria-label="Steam store" aria-describedby="([^"]+)"/);
  const id = steam.match(/aria-describedby="([^"]+)"/)![1];
  expect(steam).toContain(`role="tooltip" id="${id}"`);
  expect(steam).toContain('aria-hidden="true"');
  expect(steam).not.toContain("title=");
  expect(renderToStaticMarkup(createElement(StoreBadge, { store: "epic" }))).toContain('aria-label="Epic Games Store"');
  const windows = renderToStaticMarkup(createElement(IconLabel, { kind: "windows" }));
  expect(windows).toContain('aria-label="Windows"');
  expect(windows).toContain("<title>Windows</title>");
  expect(windows).toContain("<svg");
});

it("platform list renders labels and nothing when unknown", () => {
  const html = renderToStaticMarkup(createElement(PlatformLabels, { platforms: ["windows", "macos", "linux"] }));
  expect(html).toContain('<ul aria-label="Platforms"');
  for (const name of ["Windows", "macOS", "Linux"]) expect(html).toContain(`aria-label="${name}"`);
  expect(renderToStaticMarkup(createElement(PlatformLabels, { platforms: null }))).toBe("");
  expect(renderToStaticMarkup(createElement(PlatformLabels, { platforms: [] }))).toBe("");
});

it("rows and hero covers keep store badges without compatibility logos", () => {
  for (const store of ["steam", "epic"] as const) {
    const game: FeedGame = { id: "fixture", store, externalId: "1", kind: "free_to_keep", title: "Fixture", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: null, upcoming: false, claimed: false, platforms: ["windows", "macos", "linux"] };
    for (const component of [createElement(GameRow, { game, now: 0, signedIn: false }), createElement(CoverStack, { games: [game] })]) {
      const html = renderToStaticMarkup(component);
      expect(html).toContain(`aria-label="${store === "steam" ? "Steam store" : "Epic Games Store"}"`);
      expect(html).not.toContain('aria-label="Platforms"');
      for (const name of ["Windows", "macOS", "Linux"]) expect(html).not.toContain(`aria-label="${name}"`);
    }
  }
});

it("feed, archive and detail join verified platforms; missing or invalid payload is null", async () => {
  const db = await testDb();
  await db.executeMultiple(`INSERT INTO games(id,store,external_id,kind,title,starts_at,ends_at) VALUES
    ('s','steam','123','free_to_keep','S',1,1000),('bad','steam','5','free_to_keep','Bad',1,1000),('e','epic','e','free_to_keep','E',1,1000),('old','steam','7','free_to_keep','Old',1,50);
    INSERT INTO poll_runs(source,ok,at) VALUES('steam',1,99),('epic',1,99),('gamerpower',1,99);`);
  const steam = { "123": { success: true, data: { steam_appid: 123, type: "game", platforms: { windows: true, mac: false, linux: true } } } };
  await saveMetadata(db, "s", "steam", null, parseSteamMetadata(steam, 123, 1), 1);
  await saveMetadata(db, "old", "steam", null, { ...parseSteamMetadata(steam, 123, 1), sourceUrl: "https://store.steampowered.com/api/appdetails?appids=7&cc=id&l=en", canonicalSteamAppId: undefined, fieldSources: undefined }, 1);
  await db.execute("INSERT INTO game_metadata(game_id,provider,attempted_at,payload_json) VALUES('bad','steam',1,'{\"platforms\":[\"windows\"]}')");
  const feed = await listFeed(db, undefined, new Date(100));
  expect(Object.fromEntries(feed.freeNow.map(g => [g.id, g.platforms]))).toEqual({ s: ["windows", "linux"], bad: null, e: null });
  expect((await listArchive(db, new Date(100)))[0].platforms).toEqual(["windows", "linux"]);
  expect((await getGame(db, "s"))?.platforms).toEqual(["windows", "linux"]);
  expect((await getGame(db, "bad"))?.platforms).toBeNull();
  db.close();
});
