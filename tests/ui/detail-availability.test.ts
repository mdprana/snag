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

it("detail hides missing platforms and renders only verified platforms", async () => {
  const metadata: GameMetadata = { provider: "steam", sourceUrl: "https://store.steampowered.com/api/appdetails?appids=1&cc=id&l=en", fetchedAt: 0, locale: "en", country: "ID", aboutText: "Store summary", aboutKind: "summary", developer: null, publisher: null, platforms: null, screenshots: [] };
  vi.mocked(getGame).mockResolvedValue({ id: "a", store: "steam", externalId: "1", kind: "free_to_keep", title: "A", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: null, upcoming: false, claimed: false, platforms: null });
  for (const platforms of [null, [], ["windows"]] as GameMetadata["platforms"][]) {
    vi.mocked(readMetadataRecord).mockResolvedValueOnce({ metadata: { ...metadata, platforms }, attemptedAt: null, errorCode: null });
    const html = renderToStaticMarkup(await GamePage({ params: Promise.resolve({ id: "a" }) }));
    expect(html.includes("<dt>Platforms</dt>")).toBe(Boolean(platforms?.length));
    expect(html).toContain("<dt>Developer</dt><dd>Details not available from store yet.</dd>");
    expect(html).toContain("<dt>Publisher</dt><dd>Details not available from store yet.</dd>");
    if (platforms?.length) expect(html).toContain('aria-label="Windows"');
  }
});
