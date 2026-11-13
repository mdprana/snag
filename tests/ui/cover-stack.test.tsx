import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverStack } from "@/src/components/CoverStack";
import type { FeedGame } from "@/src/lib/games";

const game: FeedGame = { id: "fixture", store: "epic", externalId: "fixture", kind: "free_to_keep", title: "Fixture cover", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 1800000000000, endsAt: null, upcoming: true, claimed: false, platforms: null };

it("cover boundaries render zero, one, two and at most three fixture games honestly", () => {
  expect(renderToStaticMarkup(<CoverStack games={[]} />)).toBe("");
  for (const count of [1, 2, 3, 4]) {
    const html = renderToStaticMarkup(<CoverStack games={Array.from({ length: count }, (_, i) => ({ ...game, id: `fixture-${i}` }))} state="upcoming" />);
    expect(html).toContain('href="/g/fixture-0"');
    expect(html).toContain("Starts ");
    expect(html).not.toContain("Claim");
    expect(html.match(/class="cover-link"/g)).toHaveLength(1);
    if (count === 1) expect(html).not.toContain("Next game");
    else {
      expect(html).toContain(`1 / ${Math.min(count, 3)}`);
      expect(html).toContain('aria-label="Previous game" disabled=""');
    }
  }
  const archive = renderToStaticMarkup(<CoverStack games={[game]} state="archive" />);
  expect(archive).toContain("Previously free");
  expect(archive).not.toContain("Starts ");
});
