"use client";

import { useEffect, useRef, useState } from "react";
import type { GameMetadata } from "@/src/lib/metadata";

type Props = { screenshots: GameMetadata["screenshots"] };

export function ScreenshotGallery({ screenshots }: Props): React.ReactElement | null {
  const [index, setIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (index === null) return;
    returnRef.current = document.activeElement as HTMLElement;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIndex(null);
      if (event.key === "ArrowLeft") setIndex(current => current === null ? null : Math.max(0, current - 1));
      if (event.key === "ArrowRight") setIndex(current => current === null ? null : Math.min(screenshots.length - 1, current + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, screenshots.length]);

  useEffect(() => {
    if (index === null) return;
    return () => returnRef.current?.focus();
  }, [index]);

  if (!screenshots.length) return null;
  const current = index === null ? null : screenshots[index];
  return <section className="gallery" aria-labelledby="gallery-title">
    <h2 id="gallery-title">Screenshots</h2>
    <div className="gallery-grid">{screenshots.map((shot, shotIndex) => <button key={shot.url} className="gallery-thumb" type="button" onClick={() => setIndex(shotIndex)} aria-label={`Open screenshot ${shotIndex + 1}`}><img src={shot.thumbnailUrl} width="320" height="180" alt="" /></button>)}</div>
    {current && <dialog className="gallery-dialog" open aria-label="Screenshot viewer" onClick={event => { if (event.target === event.currentTarget) setIndex(null); }}>
      <div className="gallery-view"><button ref={closeRef} type="button" className="btn btn-ghost gallery-close" onClick={() => setIndex(null)}>Close</button><img src={current.url} width="1280" height="720" alt={`Screenshot ${index! + 1} of ${screenshots.length}`} /><div className="gallery-controls"><button type="button" className="btn btn-ghost" onClick={() => setIndex(value => value === null ? null : Math.max(0, value - 1))} disabled={index === 0}>Previous</button><span>{index! + 1} / {screenshots.length}</span><button type="button" className="btn btn-ghost" onClick={() => setIndex(value => value === null ? null : Math.min(screenshots.length - 1, value + 1))} disabled={index === screenshots.length - 1}>Next</button></div></div>
    </dialog>}
  </section>;
}
