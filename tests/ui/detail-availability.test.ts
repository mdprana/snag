import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GamePage from "@/app/g/[id]/page";
import { getGame, type FeedGame } from "@/src/lib/games";
import { formatUtc } from "@/src/components/Countdown";
import { readMetadataRecord, type GameMetadata } from "@/src/lib/metadata";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "" }) }));
vi.mock("@/src/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/src/lib/session", () => ({ getSession: async () => null }));
vi.mock("@/src/lib/games", () => ({ getGame: vi.fn() }));
vi.mock("@/src/lib/metadata", () => ({ readMetadataRecord: vi.fn(async () => ({ metadata: null, attemptedAt: null, errorCode: null })) }));
vi.mock("@/src/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/src/components/ClaimButton", () => ({ ClaimButton: () => null }));

it("detail warns for absent, failed, or over-90-minute availability checks, not fresh checks", async () => {
  const now = Date.UTC(2026, 10, 13, 12);
  const game: FeedGame = { id: "a", store: "epic", externalId: "a", kind: "free_to_keep", title: "A", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: now + 3600000, upcoming: false, claimed: false, platforms: null };
  vi.useFakeTimers();
  vi.setSystemTime(now);
  try {
    for (const [confirmedAt, sourceOk, warning] of [
      [undefined, true, true],
      [null, false, true],
      [now, false, true],
      [now - 90 * 60000 - 1, true, true],
      [now - 90 * 60000, true, false],
      [now, true, false],
    ] as const) {
      vi.mocked(getGame).mockResolvedValue({ ...game, confirmedAt, sourceOk });
      const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ id: game.id }) }));
      expect(html.includes('role="status"')).toBe(warning);
      if (warning) {
        expect(html).toContain("Availability may be outdated. Last checked ");
        expect(html).toContain('class="banner banner-warning"');
        expect(html).toContain('class="warning-icon" aria-hidden="true"');
        expect(html).toContain('Ends in <span class="countdown"');
        expect(html.indexOf('role="status"')).toBeGreaterThan(html.indexOf('class="countdown"'));
        expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf("Availability varies by region."));
        if (confirmedAt == null) {
          expect(html).toContain("Last checked never.");
        } else {
          expect(html).toContain(`Last checked <time dateTime="${new Date(confirmedAt).toISOString()}">${formatUtc(confirmedAt)}</time>`);
        }
      }
    }
  } finally {
    vi.useRealTimers();
  }
});

it("detail shows missing-field rows and renders only verified platform icons", async () => {
  const metadata: GameMetadata = { provider: "steam", sourceUrl: "https://store.steampowered.com/api/appdetails?appids=1&cc=id&l=en", fetchedAt: 0, locale: "en", country: "ID", aboutText: "Store summary", aboutKind: "summary", developer: null, publisher: null, platforms: null, screenshots: [] };
  vi.mocked(getGame).mockResolvedValue({ id: "a", store: "steam", externalId: "1", kind: "free_to_keep", title: "A", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: null, upcoming: false, claimed: false, platforms: null });
  for (const platforms of [null, [], ["windows"]] as GameMetadata["platforms"][]) {
    vi.mocked(readMetadataRecord).mockResolvedValueOnce({ metadata: { ...metadata, platforms }, attemptedAt: null, errorCode: null });
    const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ id: "a" }) }));
    expect(html).toContain("<dt>Platforms</dt>");
    expect(html).toContain("<dt>Developer</dt>");
    expect(html).toContain("<dt>Publisher</dt>");
    expect(html).toContain("Not listed by Steam, Epic or Wikidata");
    if (platforms?.length) expect(html).toContain('aria-label="Windows"');
  }
});

it("detail never renders placeholder copy, empty About or empty rows", async () => {
  const base: GameMetadata = { provider: "epic", sourceUrl: "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=ID&allowCountries=ID", fetchedAt: 0, locale: "en-US", country: "ID", aboutText: "", aboutKind: "summary", developer: null, publisher: null, platforms: null, screenshots: [] };
  vi.mocked(getGame).mockResolvedValue({ id: "h", store: "epic", externalId: "h", kind: "free_to_keep", title: "Herds", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: null, upcoming: false, claimed: false, platforms: null });
  for (const metadata of [null, base, { ...base, aboutText: "  \n " }, { ...base, aboutText: "herds" }, { ...base, developer: "Dev <b>x</b>" }]) {
    vi.mocked(readMetadataRecord).mockResolvedValueOnce({ metadata, attemptedAt: null, errorCode: null });
    const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ id: "h" }) }));
    expect(html).not.toMatch(/not available|Unknown|N\/A|Coming soon/);
    expect(html).toContain(">About</h2>");
    expect(html).toContain("Not listed by Steam, Epic or Wikidata");
    expect(html).not.toMatch(/<dd><\/dd>|<p class="about-text">\s*<\/p>/);
    expect(html.includes("<dt>Developer</dt><dd>Dev &lt;b&gt;x&lt;/b&gt;</dd>")).toBe(Boolean(metadata?.developer));
    expect(html).not.toContain("<dt>Source</dt>");
  }
  vi.mocked(readMetadataRecord).mockResolvedValueOnce({ metadata: { ...base, aboutText: "Real summary." }, attemptedAt: null, errorCode: null });
  const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ id: "h" }) }));
  expect(html).toContain(">About</h2>");
  expect(html).toContain('<p class="about-text">Real summary.</p>');
  expect(html).toContain("<dt>Developer</dt>");
});

it("trailer is first media item, before screenshots, and absent trailer leaves no slot", async () => {
  const shot = { url: "https://shared.akamai.steamstatic.com/s.jpg", thumbnailUrl: "https://shared.akamai.steamstatic.com/t.jpg" };
  const trailer = { kind: "native" as const, url: "https://video.akamai.steamstatic.com/store_trailers/1/a/hls_264_master.m3u8", mimeType: "application/vnd.apple.mpegurl" as const, poster: "https://shared.akamai.steamstatic.com/p.jpg", title: "Launch" };
  const base: GameMetadata = { provider: "steam", sourceUrl: "https://store.steampowered.com/api/appdetails?appids=1&cc=id&l=en", fetchedAt: 0, locale: "en", country: "ID", aboutText: "", aboutKind: "summary", developer: null, publisher: null, platforms: null, screenshots: [], canonicalSteamAppId: 1 };
  vi.mocked(getGame).mockResolvedValue({ id: "a", store: "steam", externalId: "1", kind: "free_to_keep", title: "A", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: null, upcoming: false, claimed: false, platforms: null });
  for (const metadata of [{ ...base, trailer, screenshots: [shot] }, { ...base, trailer }, { ...base, screenshots: [shot] }, { ...base, trailer: null }]) {
    vi.mocked(readMetadataRecord).mockResolvedValueOnce({ metadata, attemptedAt: null, errorCode: null });
    const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ id: "a" }) }));
    expect(html).not.toContain("<video");
    expect(html).not.toContain("m3u8");
    expect(html.includes('aria-label="Play trailer: A"')).toBe(Boolean(metadata.trailer));
    if (metadata.trailer && metadata.screenshots.length) expect(html.indexOf("Play trailer")).toBeLessThan(html.indexOf("Open screenshot 1"));
    if (!metadata.trailer && !metadata.screenshots.length) expect(html).not.toContain("gallery");
  }
});
