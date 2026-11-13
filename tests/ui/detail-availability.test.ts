import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import GamePage from "@/app/g/[id]/page";
import { getGame, type FeedGame } from "@/src/lib/games";
import { formatUtc } from "@/src/components/Countdown";

vi.mock("next/headers", () => ({ cookies: async () => ({ toString: () => "" }) }));
vi.mock("@/src/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/src/lib/session", () => ({ getSession: async () => null }));
vi.mock("@/src/lib/games", () => ({ getGame: vi.fn() }));
vi.mock("@/src/lib/metadata", () => ({ readMetadataRecord: async () => ({ metadata: null }) }));
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
        expect(html).toContain("Showing last-known offers; availability may have changed.");
        expect(html.indexOf('role="status"')).toBeGreaterThan(html.indexOf('class="countdown"'));
        expect(html.indexOf('role="status"')).toBeLessThan(html.indexOf("Availability varies by region."));
        if (confirmedAt == null) {
          expect(html).toContain("No successful availability check yet; this offer is unconfirmed.");
        } else {
          expect(html).toContain(`Last successful availability check <time dateTime="${new Date(confirmedAt).toISOString()}">${formatUtc(confirmedAt)}</time>`);
        }
      }
    }
  } finally {
    vi.useRealTimers();
  }
});
