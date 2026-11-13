import { cookies } from "next/headers";
import { db } from "@/src/lib/db";
import { lastPoll, listFeed } from "@/src/lib/games";
import { getSession } from "@/src/lib/session";
import { GameRow } from "@/src/components/GameRow";
import { SiteHeader } from "@/src/components/SiteHeader";
import { Reveal } from "@/src/components/Reveal";
import { UtcTime } from "@/src/components/Countdown";

export default async function FeedPage() {
  const session = await getSession(db(), (await cookies()).toString());
  const now = new Date();
  const feed = await listFeed(db(), session?.userId, now);
  const checked = await lastPoll(db());
  const stale = checked === null || now.getTime() - checked > 90 * 60000;
  const sections = [["Free now", feed.freeNow], ["Coming next", feed.upcoming], ["Key giveaways", feed.keyGiveaways]] as const;
  return <><SiteHeader signedIn={Boolean(session)} /><main id="main" className="shell py-8"><h1 className="page-title mb-4">Free games</h1><a href="/settings/notifications" className="text-link mb-6">Notifications</a>{stale && <p role="status" className="banner mb-8">Updates delayed. {checked === null ? "Offers have never been checked yet; nothing below is confirmed." : <>Last successful check <UtcTime at={checked} />; showing offers from that check.</>}</p>}{sections.map(([title, games]) => <section key={title} className="feed-section"><h2>{title}</h2><Reveal>{games.length ? games.map(game => <div className="entry-motion" key={game.id}><GameRow game={game} now={now.getTime()} signedIn={Boolean(session)} /></div>) : <p className="dim py-4">{title === "Free now" ? "Nothing free right now. We check every 30 minutes." : "No offers announced yet. Check back after the next update."}</p>}</Reveal></section>)}</main></>;
}
