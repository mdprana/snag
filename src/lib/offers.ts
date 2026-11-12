export type OfferWindow = { startsAt: number | null; endsAt: number | null; confirmedAt?: number | null; sourceOk?: boolean };

export function offerState(game: OfferWindow, now = Date.now()): "active" | "upcoming" | "ended" | "unconfirmed" {
  if (game.endsAt !== null && game.endsAt <= now) return "ended";
  if (game.startsAt !== null && game.startsAt > now) return "upcoming";
  if (game.endsAt === null && (game.sourceOk !== true || game.confirmedAt == null || game.confirmedAt > now || now - game.confirmedAt > 86400000)) return "unconfirmed";
  return "active";
}
