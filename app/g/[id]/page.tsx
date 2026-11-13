import { GameArt } from "@/src/components/GameArt";
import { SiteHeader } from "@/src/components/SiteHeader";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/src/lib/db";
import { getGame } from "@/src/lib/games";
import { getSession } from "@/src/lib/session";
import { PlatformLabels, StoreBadge } from "@/src/components/StoreBadge";
import { ClaimButton } from "@/src/components/ClaimButton";
import { Countdown, UtcTime } from "@/src/components/Countdown";
import { readMetadataRecord } from "@/src/lib/metadata";
import { ScreenshotGallery } from "@/src/components/ScreenshotGallery";

export default async function GamePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(db(), (await cookies()).toString());
  const now = new Date();
  const game = await getGame(db(), (await params).id);
  if (!game) notFound();
  const metadataRecord = await readMetadataRecord(db(), game.id);
  const metadata = metadataRecord.metadata;
  if (session) {
    const claim = await db().execute({ sql: "SELECT 1 FROM claims WHERE user_id = ? AND game_id = ?", args: [session.userId, game.id] });
    game.claimed = claim.rows.length > 0;
  }
  const about = metadata?.aboutText.trim() && metadata.aboutText.trim().toLowerCase() !== game.title.trim().toLowerCase() ? metadata.aboutText.trim() : "";
  const sourced = metadata && (about || metadata.developer || metadata.publisher || metadata.platforms?.length || metadata.screenshots.length) ? metadata : null;
  const ended = game.endsAt !== null && game.endsAt <= now.getTime();
  const checked = game.confirmedAt ?? null;
  const stale = checked === null || !game.sourceOk || now.getTime() - checked > 90 * 60000;
  return <><SiteHeader signedIn={Boolean(session)} /><main id="main" className="shell">
    <a href="/feed" className="text-link">Back to feed</a>
    <div className="detail">
      <div className="detail-art"><GameArt imageUrl={game.imageUrl} title={game.title} store={game.store} priority sizes="(min-width: 640px) 60vw, 100vw" /></div>
      <header className="detail-head">
        <div className="detail-title"><h1 className="page-title">{game.title}</h1><div className="detail-labels"><StoreBadge store={game.store} /><PlatformLabels platforms={game.platforms} /></div></div>
        {game.upcoming ? <p>Coming next{game.startsAt && <>: starts <UtcTime at={game.startsAt} /></>}. Claiming opens when this giveaway starts.</p>
          : ended ? <p className="dim">Offer ended <UtcTime at={game.endsAt!} />.</p>
          : game.endsAt && <p className="dim">Ends in <Countdown endsAt={game.endsAt} now={now.getTime()} /> · <UtcTime at={game.endsAt} /></p>}
        {stale && <p role="status" className="banner banner-warning"><span className="warning-icon" aria-hidden="true">!</span>Availability may be outdated. Last checked {checked === null ? "never." : <><UtcTime at={checked} />.</>}</p>}
        {game.kind === "key_giveaway" && <p className="banner">This giveaway needs a third-party account.</p>}
        <p className="dim">Availability varies by region.</p>
        <div className="detail-bar"><ClaimButton game={game} signedIn={Boolean(session)} /></div>
      </header>
      {sourced && <section className="detail-meta" {...about ? { "aria-labelledby": "about-title" } : { "aria-label": "Game details" }}>
        {about && <><h2 id="about-title">About</h2>
          <p className="about-label">{sourced.aboutKind === "full" ? "Full description" : "Store summary"}</p>
          <p className="about-text">{about}</p></>}
        <dl className="metadata-list">
          {sourced.developer && <div><dt>Developer</dt><dd>{sourced.developer}</dd></div>}
          {sourced.publisher && <div><dt>Publisher</dt><dd>{sourced.publisher}</dd></div>}
          {!!sourced.platforms?.length && <div><dt>Platforms</dt><dd><PlatformLabels platforms={sourced.platforms} /></dd></div>}
          <div><dt>Source</dt><dd>{sourced.provider === "steam" ? "Steam" : "Epic Games"}</dd></div>
          <div><dt>Last checked</dt><dd><UtcTime at={sourced.fetchedAt} /></dd></div>
        </dl>
        <ScreenshotGallery screenshots={sourced.screenshots} />
      </section>}
    </div>
  </main></>;
}
