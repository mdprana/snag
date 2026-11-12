import { connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/lib/db";
import { lastPoll, listArchive, listFeed, soonestEnding } from "@/src/lib/games";
import { selectHero } from "@/src/lib/hero";
import { GameArt } from "@/src/components/GameArt";
import { getSession } from "@/src/lib/session";
import { SiteHeader } from "@/src/components/SiteHeader";
import { Reveal } from "@/src/components/Reveal";
import { GameRow } from "@/src/components/GameRow";
import { Countdown, formatUtc } from "@/src/components/Countdown";

export default async function Home() {
  await connection();
  const now = new Date();
  const session = await getSession(db(), (await cookies()).toString());
  const database = db();
  const feed = await listFeed(database, session?.userId, now);
  const archive = await listArchive(database, now);
  const checked = await lastPoll(database);
  const ending = soonestEnding(feed.freeNow);
  const hero = selectHero(feed.freeNow, feed.upcoming, archive);
  const stale = checked === null || now.getTime() - checked > 90 * 60000;
  const heroTitle = hero.state === "active" ? `${feed.freeNow.length} games free to keep right now` : hero.state === "upcoming" ? "Next drop on the horizon" : "Between drops. Stay ready.";
  return <>
    <SiteHeader signedIn={Boolean(session)} />
    <main id="main" className="shell">
      <section className="hero" aria-labelledby="available-title">
        <div className="enter">
          <h1 id="available-title" className="hero-title">{hero.state === "active" ? <><span data-testid="free-count">{feed.freeNow.length}</span> games free to keep<br />right now</> : heroTitle}</h1>
          <p className="hero-copy dim mt-5">Epic and Steam offers, with time to claim before they disappear.</p>
          {hero.state === "active" && ending?.endsAt && <div className="my-7"><p className="meta mb-3">First offer ends in</p><div className="numeral"><Countdown endsAt={ending.endsAt} now={now.getTime()} /></div><p className="dim mt-3">{ending.title}. Claim before <time dateTime={new Date(ending.endsAt).toISOString()}>{formatUtc(ending.endsAt)}</time>.</p></div>}
          {hero.state === "upcoming" && hero.game?.startsAt && <p className="hero-copy mt-7">Coming next: <time dateTime={new Date(hero.game.startsAt).toISOString()}>{formatUtc(hero.game.startsAt)}</time>.</p>}
          {hero.state === "archive" && <p className="hero-copy mt-7">Previously featured. Not currently available.</p>}
          <a className="btn btn-signal mt-6" href={hero.state === "active" ? "/feed" : hero.game ? `/g/${encodeURIComponent(hero.game.id)}` : "/feed"}>{hero.state === "active" ? "Browse free games" : hero.state === "upcoming" ? "View upcoming game" : "View game details"}</a>
        </div>
        {hero.game ? <a className="hero-art-link" href={`/g/${encodeURIComponent(hero.game.id)}`}><GameArt imageUrl={hero.game.imageUrl} title={hero.game.title} store={hero.game.store} priority eager sizes="(min-width: 1024px) 520px, 90vw" /></a> : <div className="hero-empty-art" aria-hidden="true"><span>SNAG</span></div>}
      </section>
      <p role="status" className="banner mb-8">{stale ? "Updates delayed. " : "Offers checked "}{checked === null ? "No successful checks yet; availability is unconfirmed." : <><time dateTime={new Date(checked).toISOString()}>{formatUtc(checked)}</time>{stale ? "; showing last known offers." : "."}</>} Availability varies by region.</p>
      {feed.upcoming.length > 0 && <section className="section" aria-labelledby="next-title"><h2 id="next-title" className="section-title mb-6">Coming next</h2><Reveal>{feed.upcoming.map(game => <GameRow key={game.id} game={game} now={now.getTime()} signedIn={Boolean(session)} />)}</Reveal></section>}
      <section className="section" aria-labelledby="notifications-title"><Reveal className="split"><div><h2 id="notifications-title" className="section-title">Know when the next drop lands.</h2><p className="dim mt-5 max-w-lg">Sign in with Steam, add Snag to your Home Screen, then enable notifications. Open each offer at its store and mark it claimed.</p><a className="text-link mt-5" href="/settings/notifications">Set up notifications</a></div><p className="statement">Your public identity.<br />Never your password.<br />You make the claim.</p></Reveal></section>
      <section className="section" aria-labelledby="host-title"><Reveal><h2 id="host-title" className="section-title">Want auto-claim?</h2><p className="dim mt-5 max-w-xl">Run the claim tools on your own always-on machine. Snag does not store your store passwords or claim games for you.</p><a className="text-link mt-5" href="/self-host">Read the self-host guide</a></Reveal></section>
    </main>
    <footer className="site-footer"><Reveal className="shell footer-inner"><a className="text-link" href="/privacy">Privacy</a><a className="text-link" href="/self-host">Self-host</a><p className="dim">Not affiliated with Valve or Epic Games.</p></Reveal></footer>
  </>;
}
