import { expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverStack } from "@/src/components/CoverStack";
import type { FeedGame } from "@/src/lib/games";

const game: FeedGame = { id: "fixture", store: "epic", externalId: "fixture", kind: "free_to_keep", title: "Fixture cover", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 1800000000000, endsAt: null, upcoming: true, claimed: false, platforms: null };

it("cover fan renders zero, one, two and at most three fixture games without controls or inline styles", () => {
  expect(renderToStaticMarkup(<CoverStack games={[]} />)).toBe("");
  for (const count of [1, 2, 3, 4]) {
    const html = renderToStaticMarkup(<CoverStack games={Array.from({ length: count }, (_, i) => ({ ...game, id: `fixture-${i}` }))} state="upcoming" />);
    expect(html).toContain(`data-count="${Math.min(count, 3)}"`);
    expect(html.match(/class="cover-link"/g)).toHaveLength(Math.min(count, 3));
    expect(html).toContain("Starts ");
    expect(html).not.toMatch(/Next game|Previous game|style=/);
  }
  const archive = renderToStaticMarkup(<CoverStack games={[game]} state="archive" />);
  expect(archive).toContain("Previously free");
  expect(archive).not.toContain("Starts ");
});
