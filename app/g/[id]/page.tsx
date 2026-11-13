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
  const missing = "Details not available from store yet.";
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
      <section className="detail-meta" aria-labelledby="about-title">
        <h2 id="about-title">About</h2>
        {metadata ? <>
          <p className="about-label">{metadata.aboutKind === "full" ? "Full description" : "Store summary"}</p>
          <p className="about-text">{metadata.aboutText || missing}</p>
          <dl className="metadata-list">
            <div><dt>Developer</dt><dd>{metadata.developer || missing}</dd></div>
            <div><dt>Publisher</dt><dd>{metadata.publisher || missing}</dd></div>
            {!!metadata.platforms?.length && <div><dt>Platforms</dt><dd><PlatformLabels platforms={metadata.platforms} /></dd></div>}
            <div><dt>Source</dt><dd>{metadata.provider === "steam" ? "Steam" : "Epic Games"}</dd></div>
            <div><dt>Last checked</dt><dd><UtcTime at={metadata.fetchedAt} /></dd></div>
          </dl>
          <ScreenshotGallery screenshots={metadata.screenshots} />
        </> : <p className="dim">{missing}</p>}
      </section>
    </div>
  </main></>;
}
