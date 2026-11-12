import Link from "next/link";
import Image from "next/image";
import type { FeedGame } from "@/src/lib/games";
import { safeImageUrl } from "@/src/lib/urls";
import { Countdown } from "./Countdown";
import { ClaimButton } from "./ClaimButton";
import { StoreBadge } from "./StoreBadge";

export function GameRow({ game, now, signedIn }: { game: FeedGame; now: number; signedIn: boolean }): React.ReactElement {
  const image = safeImageUrl(game.imageUrl);
  if (game.claimed) return <article className="flex items-center justify-between gap-3 border-b border-white/10 py-2"><Link href={`/g/${game.id}`} className="min-h-11 py-3 text-green-300">Claimed: {game.title}</Link><ClaimButton game={game} signedIn={signedIn} /></article>;
  return <article className={`flex flex-wrap items-start gap-3 border-b border-white/10 py-4 ${game.upcoming ? "opacity-70" : ""}`}>
    {image && <Image unoptimized src={image} width={96} height={54} alt={game.title} className="aspect-video w-24 rounded object-cover" />}
    <div className="min-w-0 flex-1"><h3 className="text-lg font-semibold"><Link href={`/g/${game.id}`}>{game.title}</Link></h3><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/70"><StoreBadge store={game.store} />{game.upcoming && game.startsAt ? <time dateTime={new Date(game.startsAt).toISOString()}>Starts {new Date(game.startsAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</time> : game.endsAt && <Countdown endsAt={game.endsAt} now={now} />}</div></div>
    <ClaimButton game={game} signedIn={signedIn} />
  </article>;
}
