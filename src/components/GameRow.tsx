import Link from "next/link";
import type { FeedGame } from "@/src/lib/games";
import { Countdown, UtcTime } from "./Countdown";
import { ClaimButton } from "./ClaimButton";
import { GameArt } from "./GameArt";
import { PlatformLabels, StoreBadge } from "./StoreBadge";

export function GameRow({ game, now, signedIn }: { game: FeedGame; now: number; signedIn: boolean }): React.ReactElement {
  if (game.claimed) return <article className="game-row game-row-claimed border-b border-white/10 py-2"><Link href={`/g/${game.id}`} className="game-row-title min-h-11 py-3 text-green-300">Claimed: {game.title}</Link><div className="game-row-actions"><ClaimButton game={game} signedIn={signedIn} /></div></article>;
  return <article className={`game-row border-b border-line py-4 ${game.upcoming ? "text-ink-dim" : ""}`}>
    <GameArt imageUrl={game.imageUrl} title={game.title} store={game.store} />
    <div className="game-row-title min-w-0"><h3 className="text-lg font-semibold"><Link href={`/g/${game.id}`}>{game.title}</Link></h3><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-dim"><StoreBadge store={game.store} /><PlatformLabels platforms={game.platforms} />{game.upcoming && game.startsAt ? <span>Starts <UtcTime at={game.startsAt} /></span> : game.endsAt && <Countdown endsAt={game.endsAt} now={now} />}</div></div>
    {!game.upcoming && <div className="game-row-actions"><ClaimButton game={game} signedIn={signedIn} /></div>}
  </article>;
}
