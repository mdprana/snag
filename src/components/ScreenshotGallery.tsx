"use client";

import { useEffect, useRef, useState } from "react";
import type { GameMetadata } from "@/src/lib/metadata";
import { safeImageUrl, safeTrailerUrl } from "@/src/lib/urls";

type Props = { screenshots: GameMetadata["screenshots"]; trailer?: GameMetadata["trailer"]; title?: string; steamAppId?: number };

export function ScreenshotGallery({ screenshots, trailer: candidate, title = "", steamAppId }: Props): React.ReactElement | null {
  const trailer = candidate && steamAppId && safeTrailerUrl(candidate.url, steamAppId) && safeImageUrl(candidate.poster) ? candidate : null;
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState<number | null>(null);
  const [canHls, setCanHls] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);
  const offset = trailer ? 1 : 0;
  const count = screenshots.length + offset;

  useEffect(() => {
    if (index === null) return;
    if (!dialogRef.current?.open) dialogRef.current?.showModal();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") {
        const controls = dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], video[controls]');
        const first = controls?.[0], last = controls?.[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      if (event.target instanceof HTMLVideoElement) return;
      if (event.key === "ArrowLeft") setIndex(current => current === null ? null : Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex(current => current === null ? null : Math.min(count - 1, current + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, count]);

  const open = index !== null;
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    return () => returnRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const stop = () => { if (document.hidden) setIndex(null); };
    const observer = new IntersectionObserver(entries => { if (!entries[0].isIntersecting) videoRef.current?.pause(); });
    if (videoRef.current) observer.observe(videoRef.current);
    document.addEventListener("visibilitychange", stop);
    return () => { document.removeEventListener("visibilitychange", stop); observer.disconnect(); };
  }, [open, index]);

  if (!count) return null;
  const show = (next: number) => {
    returnRef.current = document.activeElement as HTMLElement;
    setFailed(false);
    if (trailer) setCanHls(document.createElement("video").canPlayType(trailer.mimeType) !== "");
    setIndex(next);
  };
  const shot = index === null || index < offset ? null : screenshots[index - offset];
  const steamPage = steamAppId ? `https://store.steampowered.com/app/${steamAppId}/` : null;
  return <section className="gallery" aria-labelledby="gallery-title">
    <h2 id="gallery-title">{trailer ? "Media" : "Screenshots"}</h2>
    <div className="gallery-grid">
      {trailer && <button className="gallery-thumb gallery-trailer" type="button" onClick={() => show(0)} aria-label={`Play trailer: ${title || trailer.title}`}><img src={trailer.poster} width="320" height="180" alt="" /><span className="play-badge" aria-hidden="true">▶</span></button>}
      {screenshots.map((item, shotIndex) => <button key={item.url} className="gallery-thumb" type="button" onClick={() => show(shotIndex + offset)} aria-label={`Open screenshot ${shotIndex + 1}`}><img src={item.thumbnailUrl} width="320" height="180" alt="" /></button>)}
    </div>
    {trailer && <p className="dim gallery-note">The trailer streams from Steam only after you open it.</p>}
    {index !== null && <dialog ref={dialogRef} className="gallery-dialog" aria-label={shot ? "Screenshot viewer" : "Trailer player"} onClose={() => setIndex(null)} onClick={event => { if (event.target === event.currentTarget) setIndex(null); }}>
      <div className="gallery-view"><button ref={closeRef} type="button" className="btn btn-ghost gallery-close" onClick={() => setIndex(null)}>Close</button>
        {shot ? <img src={shot.url} width="1280" height="720" alt={`Screenshot ${index - offset + 1} of ${screenshots.length}`} />
          : canHls && !failed ? <video ref={videoRef} key="trailer" src={trailer!.url} poster={trailer!.poster} width="1280" height="720" controls playsInline preload="none" onError={() => setFailed(true)} aria-label={`Trailer: ${trailer!.title}`} />
          : <p className="trailer-fallback" role="status">{failed ? "Trailer could not load. " : "This browser cannot play the Steam trailer here. "} {steamPage && <a className="text-link" href={steamPage} target="_blank" rel="noopener noreferrer">Watch trailer on Steam</a>}</p>}
        <div className="gallery-controls"><button type="button" className="btn btn-ghost" onClick={() => setIndex(value => value === null ? null : Math.max(0, value - 1))} disabled={index === 0}>Previous</button><span>{index + 1} / {count}</span><button type="button" className="btn btn-ghost" onClick={() => setIndex(value => value === null ? null : Math.min(count - 1, value + 1))} disabled={index === count - 1}>Next</button></div></div>
    </dialog>}
  </section>;
}
