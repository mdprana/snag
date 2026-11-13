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
import { DetailBar } from "@/src/components/DetailBar";
import { DetailValue } from "@/src/components/DetailValue";
import { safeImageUrl } from "@/src/lib/urls";

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
  const imageUrl = safeImageUrl(game.imageUrl) ?? "";
  const fallbackImageUrl = metadata?.screenshots[0]?.url ? safeImageUrl(metadata.screenshots[0].url) ?? "" : "";
  const sources = [...new Map(Object.values(metadata?.fieldSources ?? {}).map(source => [source.provider, source])).values()];
  const ended = game.endsAt !== null && game.endsAt <= now.getTime();
  const checked = game.confirmedAt ?? null;
  const stale = checked === null || !game.sourceOk || now.getTime() - checked > 90 * 60000;
  return <><SiteHeader signedIn={Boolean(session)} /><main id="main" className="shell">
    <a href="/feed" className="text-link">Back to feed</a>
    <div className="detail">
      <div className="detail-art"><GameArt imageUrl={imageUrl} fallbackImageUrl={fallbackImageUrl} title={game.title} store={game.store} priority sizes="(min-width: 640px) 60vw, 100vw" /></div>
      <header className="detail-head">
        <div className="detail-title"><h1 className="page-title">{game.title}</h1><div className="detail-labels"><StoreBadge store={game.store} /></div></div>
        {game.upcoming ? <p>Coming next{game.startsAt && <>: starts <UtcTime at={game.startsAt} /></>}. Claiming opens when this giveaway starts.</p>
          : ended ? <p className="dim">Offer ended <UtcTime at={game.endsAt!} />.</p>
          : game.endsAt && <p className="dim">Ends in <Countdown endsAt={game.endsAt} now={now.getTime()} /> · <UtcTime at={game.endsAt} /></p>}
        {stale && <p role="status" className="banner banner-warning"><span className="warning-icon" aria-hidden="true">!</span>Availability may be outdated. Last checked {checked === null ? "never." : <><UtcTime at={checked} />.</>}</p>}
        {game.kind === "key_giveaway" && <p className="banner">This giveaway needs a third-party account.</p>}
        <p className="dim">Availability varies by region.</p>
        <DetailBar><ClaimButton game={game} signedIn={Boolean(session)} /></DetailBar>
      </header>
      <section className="detail-meta" aria-labelledby="about-title">
        <h2 id="about-title">About</h2>
        {about && <p className="about-label">{metadata?.aboutKind === "full" ? "Full description" : "Store summary"}</p>}
        <p className="about-text"><DetailValue value={about} /></p>
        <dl className="metadata-list">
          <div><dt>Developer</dt><dd><DetailValue value={metadata?.developer} /></dd></div>
          <div><dt>Publisher</dt><dd><DetailValue value={metadata?.publisher} /></dd></div>
          <div><dt>Platforms</dt><dd><DetailValue value={metadata?.platforms?.length ? <PlatformLabels platforms={metadata.platforms} /> : null} /></dd></div>
          <div><dt>Release date</dt><dd><DetailValue value={metadata?.releaseDate} /></dd></div>
          <div><dt>Genre</dt><dd><DetailValue value={metadata?.genres?.join(", ")} /></dd></div>
          {!!sources.length && <div><dt>Source</dt><dd>{sources.map((source, index) => <span key={source.provider}>{index > 0 && ", "}<a className="text-link" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.provider === "steam" ? "Steam" : source.provider === "epic" ? "Epic Games" : "Wikidata"}</a></span>)}</dd></div>}
          {metadata && <div><dt>Last checked</dt><dd><UtcTime at={metadata.fetchedAt} /></dd></div>}
        </dl>
        {metadata && <ScreenshotGallery screenshots={metadata.screenshots} trailer={metadata.trailer} title={game.title} steamAppId={metadata.canonicalSteamAppId} />}
      </section>
    </div>
  </main></>;
}
