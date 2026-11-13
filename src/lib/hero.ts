import type { FeedGame } from "./games";

export type HeroState = "active" | "upcoming" | "archive" | "empty";
export type HeroSelection = { state: HeroState; game: FeedGame | null; games: FeedGame[] };

const MAX = Number.MAX_SAFE_INTEGER;

export function selectHero(active: FeedGame[], upcoming: FeedGame[], archive: FeedGame[]): HeroSelection {
  const pick = (games: FeedGame[], order: (a: FeedGame, b: FeedGame) => number) => games.filter(game => game.imageUrl.trim() !== "").sort(order).slice(0, 3);
  const candidates: [HeroState, FeedGame[]][] = [
    ["active", pick(active.filter(game => game.kind === "free_to_keep"), (a, b) => (a.endsAt ?? MAX) - (b.endsAt ?? MAX))],
    ["upcoming", pick(upcoming, (a, b) => (a.startsAt ?? MAX) - (b.startsAt ?? MAX))],
    ["archive", pick(archive, (a, b) => (b.endsAt ?? 0) - (a.endsAt ?? 0))],
  ];
  const [state, games] = candidates.find(([, games]) => games.length) ?? ["empty", []];
  return { state, game: games[0] ?? null, games };
}
