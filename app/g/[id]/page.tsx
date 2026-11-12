import { GameArt } from "@/src/components/GameArt";
import { SiteHeader } from "@/src/components/SiteHeader";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/src/lib/db";
import { getGame } from "@/src/lib/games";
import { getSession } from "@/src/lib/session";
import { StoreBadge } from "@/src/components/StoreBadge";
import { ClaimButton } from "@/src/components/ClaimButton";
import { Countdown } from "@/src/components/Countdown";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(db(), (await cookies()).toString());
  const now = new Date();
  const game = await getGame(db(), (await params).id);
  if (!game) notFound();
  if (session) {
    const claim = await db().execute({ sql: "SELECT 1 FROM claims WHERE user_id = ? AND game_id = ?", args: [session.userId, game.id] });
    game.claimed = claim.rows.length > 0;
  }
  return <><SiteHeader signedIn={Boolean(session)} /><main id="main" className="shell"><a href="/feed" className="text-link">Back to feed</a><div className="detail"><GameArt imageUrl={game.imageUrl} title={game.title} store={game.store} priority /><article className="space-y-5"><StoreBadge store={game.store} /><h1 className="page-title">{game.title}</h1>{game.endsAt && <p className="dim"><Countdown endsAt={game.endsAt} now={now.getTime()} /> · <time dateTime={new Date(game.endsAt).toISOString()}>{new Date(game.endsAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</time></p>}{game.upcoming && <p>Coming next. Claiming opens when this giveaway starts.</p>}{game.kind === "key_giveaway" && <p className="banner">This giveaway needs a third-party account.</p>}<div className="detail-bar"><ClaimButton game={game} signedIn={Boolean(session)} /></div></article></div></main></>;
}
