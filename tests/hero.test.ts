import { describe, expect, it } from "vitest";
import { selectHero } from "@/src/lib/hero";

const game = (id: string, imageUrl: string, endsAt: number | null = null, startsAt: number | null = null) => ({ id, imageUrl, endsAt, startsAt, title: id } as never);

describe("selectHero", () => {
  it("prefers artwork from active, then upcoming, archive, then empty", () => {
    expect(selectHero([game("active", "", 20), game("lead", "art", 30)], [], [])).toEqual({ state: "active", game: game("lead", "art", 30) });
    expect(selectHero([], [game("next", "art", null, 20)], [])).toEqual({ state: "upcoming", game: game("next", "art", null, 20) });
    expect(selectHero([], [], [game("old", "art", 10)])).toEqual({ state: "archive", game: game("old", "art", 10) });
    expect(selectHero([], [], [game("old", "")])).toEqual({ state: "empty", game: null });
  });
});
