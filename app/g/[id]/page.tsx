import Image from "next/image";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/src/lib/db";
import { getGame } from "@/src/lib/games";
import { getSession } from "@/src/lib/session";
import { safeImageUrl } from "@/src/lib/urls";
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
  const image = safeImageUrl(game.imageUrl);
  return <main className="mx-auto w-full max-w-2xl pb-64"><a href="/feed" className="block min-h-11 px-4 py-3 underline">Back to feed</a>{image && <Image unoptimized src={image} width={960} height={540} alt={game.title} className="aspect-video w-full object-cover" />}<article className="space-y-5 px-4 py-6"><StoreBadge store={game.store} /><h1 className="text-4xl font-semibold">{game.title}</h1>{game.endsAt && <p className="text-white/70"><Countdown endsAt={game.endsAt} now={now.getTime()} /> · <time dateTime={new Date(game.endsAt).toISOString()}>{new Date(game.endsAt).toLocaleString("en-US", { timeZone: "UTC" })} UTC</time></p>}{game.upcoming && <p>Coming next. Claiming opens when this giveaway starts.</p>}{game.kind === "key_giveaway" && <p className="border border-white/20 p-3">This giveaway needs a third-party account.</p>}<div className="fixed inset-x-0 bottom-0 border-t border-white/20 bg-[#0b0a09] px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:static sm:border-0"><ClaimButton game={game} signedIn={Boolean(session)} /></div></article></main>;
}
