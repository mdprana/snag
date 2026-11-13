import { describe, expect, it } from "vitest";
import { selectHero } from "@/src/lib/hero";

const game = (id: string, imageUrl: string, endsAt: number | null = null, startsAt: number | null = null, kind = "free_to_keep") => ({ id, imageUrl, endsAt, startsAt, title: id, kind } as never);
const ids = (games: { id: string }[]) => games.map(item => item.id);

describe("selectHero", () => {
  it("active: up to 3 free_to_keep games with art, soonest ending first", () => {
    const hero = selectHero([game("noart", "", 5), game("c", "art", 40), game("a", "art", 10), game("key", "art", 1, null, "key_giveaway"), game("b", "art", 20), game("d", "art", 50)], [game("u", "art", null, 1)], []);
    expect(hero.state).toBe("active");
    expect(ids(hero.games)).toEqual(["a", "b", "c"]);
    expect(hero.game?.id).toBe("a");
  });
  it("upcoming when no active art, soonest start first", () => {
    const hero = selectHero([game("noart", "", 5)], [game("late", "art", null, 30), game("soon", "art", null, 20), game("blank", " ", null, 1)], [game("old", "art", 10)]);
    expect(hero).toMatchObject({ state: "upcoming", game: { id: "soon" } });
    expect(ids(hero.games)).toEqual(["soon", "late"]);
  });
  it("archive when nothing current has art, most recent first", () => {
    const hero = selectHero([], [], [game("older", "art", 10), game("newer", "art", 20)]);
    expect(hero).toMatchObject({ state: "archive", game: { id: "newer" } });
    expect(ids(hero.games)).toEqual(["newer", "older"]);
  });
  it("empty when no art anywhere", () => {
    expect(selectHero([game("a", "")], [game("u", "")], [game("old", "")])).toEqual({ state: "empty", game: null, games: [] });
    expect(selectHero([], [], [])).toEqual({ state: "empty", game: null, games: [] });
  });
});
