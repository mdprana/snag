import type { FeedGame } from "./games";

export type HeroState = "active" | "upcoming" | "archive" | "empty";
export type HeroSelection = { state: HeroState; game: FeedGame | null };

export function selectHero(active: FeedGame[], upcoming: FeedGame[], archive: FeedGame[]): HeroSelection {
  const withArt = (games: FeedGame[]) => games.filter(game => game.imageUrl.trim() !== "");
  const current = withArt(active).sort((a, b) => (a.endsAt ?? Number.MAX_SAFE_INTEGER) - (b.endsAt ?? Number.MAX_SAFE_INTEGER))[0];
  if (current) return { state: "active", game: current };
  const next = withArt(upcoming).sort((a, b) => (a.startsAt ?? Number.MAX_SAFE_INTEGER) - (b.startsAt ?? Number.MAX_SAFE_INTEGER))[0];
  if (next) return { state: "upcoming", game: next };
  const previous = withArt(archive).sort((a, b) => (b.endsAt ?? 0) - (a.endsAt ?? 0))[0];
  return { state: previous ? "archive" : "empty", game: previous ?? null };
}
