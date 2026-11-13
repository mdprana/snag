import { connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/src/lib/db";
import { lastPoll, listArchive, listFeed, soonestEnding } from "@/src/lib/games";
import { selectHero } from "@/src/lib/hero";
import { CoverStack } from "@/src/components/CoverStack";
import { getSession } from "@/src/lib/session";
import { SiteHeader } from "@/src/components/SiteHeader";
import { Reveal } from "@/src/components/Reveal";
import { GameRow } from "@/src/components/GameRow";
import { Countdown, UtcTime } from "@/src/components/Countdown";

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
  const live = feed.freeNow.length > 0;
  const copy = live ? "active" : hero.state;
  return <>
    <SiteHeader signedIn={Boolean(session)} />
    <main id="main" className="shell">
      <section className="hero" aria-labelledby="available-title">
        <h1 id="available-title" className="hero-title hero-head enter">{live ? <><span data-testid="free-count">{feed.freeNow.length}</span> games free to keep<br />right now</> : copy === "upcoming" ? "Next drop on the horizon" : "Between drops. Stay ready."}</h1>
        {hero.games.length > 0 && <div className="hero-art"><CoverStack games={hero.games} state={hero.state} /></div>}
        <div className="hero-body enter">
          <p className="hero-copy dim">Epic and Steam offers, with time to claim before they disappear.</p>
          {live && ending?.endsAt && <div className="hero-ending"><p className="hero-game">{ending.title}</p><p className="hero-countdown"><span className="meta">Ends in</span> <Countdown endsAt={ending.endsAt} now={now.getTime()} /></p><p className="dim">Claim before <UtcTime at={ending.endsAt} />.</p></div>}
          {copy === "upcoming" && hero.game?.startsAt && <p className="hero-copy mt-7">Coming next: <UtcTime at={hero.game.startsAt} />.</p>}
          {copy === "archive" && <p className="hero-copy mt-7">Previously featured. Not currently available.</p>}
          <a className="btn btn-signal mt-6" href={live || copy === "upcoming" ? "/feed" : hero.game ? `/g/${encodeURIComponent(hero.game.id)}` : "/feed"}>{live ? "Browse free games" : copy === "upcoming" ? "View upcoming game" : "View game details"}</a>
        </div>
      </section>
      <p role="status" className={`banner mb-8${stale ? " banner-warning" : ""}`}>{stale && <span className="warning-icon" aria-hidden="true">!</span>}{stale ? "Availability may be outdated. Last checked " : "Offers checked "}{checked === null ? "never." : <><UtcTime at={checked} />.</>} Availability varies by region.</p>
      {feed.upcoming.length > 0 && <section className="section" aria-labelledby="next-title"><h2 id="next-title" className="section-title mb-6">Coming next</h2><Reveal>{feed.upcoming.map(game => <GameRow key={game.id} game={game} now={now.getTime()} signedIn={Boolean(session)} />)}</Reveal></section>}
      <section className="section" aria-labelledby="notifications-title"><Reveal className="split"><div><h2 id="notifications-title" className="section-title">Know when the next drop lands.</h2><p className="dim mt-5 max-w-lg">Sign in with Steam, add Snag to your Home Screen, then enable notifications. Open each offer at its store and mark it claimed.</p><a className="btn btn-ghost mt-5" href="/settings/notifications">Set up notifications</a></div><p className="statement">Your public identity.<br />Never your password.<br />You make the claim.</p></Reveal></section>
      <section className="section" aria-labelledby="host-title"><Reveal><h2 id="host-title" className="section-title">Want auto-claim?</h2><p className="dim mt-5 max-w-xl">Run the claim tools on your own always-on machine. Snag does not store your store passwords or claim games for you.</p><a className="text-link mt-5" href="/self-host">Read the self-host guide</a></Reveal></section>
    </main>
    <footer className="site-footer"><div className="shell footer-inner"><a className="text-link" href="/privacy">Privacy</a><a className="text-link" href="/self-host">Self-host</a><p className="dim">Not affiliated with Valve or Epic Games.</p></div></footer>
  </>;
}
