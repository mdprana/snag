import { expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CoverStack } from "@/src/components/CoverStack";
import type { FeedGame } from "@/src/lib/games";

const game: FeedGame = { id: "fixture", store: "epic", externalId: "fixture", kind: "free_to_keep", title: "Fixture cover", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 1800000000000, endsAt: null, upcoming: true, claimed: false, platforms: null };

it.each([0, 1, 2, 3, 4])("cover fan renders %i games with a three-card cap and no controls or inline styles", count => {
  const games = Array.from({ length: count }, (_, i) => ({ ...game, id: `fixture-${i}`, title: `Fixture ${i}` }));
  const html = renderToStaticMarkup(createElement(CoverStack, { games, state: "upcoming" }));
  if (count === 0) {
    expect(html).toBe("");
    return;
  }
  expect(html).toContain(`data-count="${Math.min(count, 3)}"`);
  expect(html.match(/class="cover-link"/g)).toHaveLength(Math.min(count, 3));
  for (let i = 0; i < Math.min(count, 3); i++) expect(html).toContain(`href="/g/fixture-${i}"`);
  expect(html).not.toContain("fixture-3");
  expect(html).toContain("Starts ");
  expect(html).not.toMatch(/Next game|Previous game|style=/);
});

it("archive cover keeps its status distinct from upcoming", () => {
  const archive = renderToStaticMarkup(createElement(CoverStack, { games: [game], state: "archive" }));
  expect(archive).toContain("Previously free");
  expect(archive).not.toContain("Starts ");
});
