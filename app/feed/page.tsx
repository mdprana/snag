import { cookies } from "next/headers";
import { db } from "@/src/lib/db";
import { listFeed } from "@/src/lib/games";
import { getSession } from "@/src/lib/session";
import { GameRow } from "@/src/components/GameRow";
import { Logo } from "@/src/components/Logo";

export default async function FeedPage() {
  const session = await getSession(db(), (await cookies()).toString());
  const now = new Date();
  const feed = await listFeed(db(), session?.userId, now);
  const poll = await db().execute("SELECT MAX(at) AS at FROM poll_runs WHERE ok = 1");
  const stale = !poll.rows[0]?.at || now.getTime() - Number(poll.rows[0].at) > 90 * 60000;
  const sections = [["Free now", feed.freeNow], ["Coming next", feed.upcoming], ["Key giveaways", feed.keyGiveaways]] as const;
  return <main className="mx-auto w-full max-w-2xl px-4 py-8"><header className="mb-8 flex items-end justify-between gap-3"><div><Logo /><h1 className="mt-3 text-4xl font-semibold">Free games</h1></div><a href="/settings/notifications" className="min-h-11 py-3 text-sm underline">Notifications</a></header>{stale && <p role="status" className="mb-6 border border-orange-300 p-3">Updates delayed. Last known games shown; last successful check over 90 minutes ago or not yet available.</p>}{sections.map(([title, games]) => <section key={title} className="mb-8"><h2 className="mb-2 text-xl font-semibold">{title}</h2>{games.length ? games.map((game) => <GameRow key={game.id} game={game} now={now.getTime()} signedIn={Boolean(session)} />) : <p className="border-y border-white/10 py-4 text-white/60">{title === "Free now" ? "Nothing free right now. We check every 30 minutes." : "Nothing here right now."}</p>}</section>)}</main>;
}
