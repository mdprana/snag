"use client";

import { useEffect, useRef, useState } from "react";
import type { FeedGame } from "@/src/lib/games";
import type { HeroState } from "@/src/lib/hero";
import { UtcTime } from "./Countdown";
import { GameArt } from "./GameArt";
import { StoreBadge } from "./StoreBadge";

function Status({ game, state }: { game: FeedGame; state: HeroState }): React.ReactElement | null {
  if (state === "upcoming" && game.startsAt) return <span className="cover-status">Starts <UtcTime at={game.startsAt} /></span>;
  return state === "archive" ? <span className="cover-status">Previously free</span> : null;
}

export function CoverStack({ games, state = "active" }: { games: FeedGame[]; state?: HeroState }): React.ReactElement | null {
  const stage = useRef<HTMLDivElement>(null);
  const slide = useRef<HTMLDivElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const visible = useRef(true);
  const direction = useRef(1);
  const animation = useRef<Animation | null>(null);
  const [selection, setSelection] = useState({ index: 0, collection: "", manual: false });
  const covers = games.slice(0, 3);
  const collection = `${state}:${covers.map(game => game.id).join(",")}`;
  const index = selection.collection === collection ? Math.min(selection.index, covers.length - 1) : 0;
  const game = covers[index];
  const hasGame = Boolean(game);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const settle = () => { animation.current?.cancel(); gesture.current = null; };
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => { if (media.matches) settle(); };
    const hidden = () => { if (document.hidden) settle(); };
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; if (!entry.isIntersecting) settle(); });
    observer.observe(element);
    media.addEventListener("change", change);
    document.addEventListener("visibilitychange", hidden);
    return () => { settle(); observer.disconnect(); media.removeEventListener("change", change); document.removeEventListener("visibilitychange", hidden); };
  }, [hasGame]);

  useEffect(() => {
    animation.current?.cancel();
    if (!selection.manual || !slide.current || document.hidden || !visible.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    animation.current = slide.current.animate([
      { opacity: 0, transform: `translateX(${direction.current * 24}px)` },
      { opacity: 1, transform: "translateX(0)" },
    ], { duration: 320, easing: "cubic-bezier(0.22,1,0.36,1)" });
    return () => animation.current?.cancel();
  }, [index, collection, selection.manual]);

  function move(delta: number) {
    if (document.hidden || !visible.current) return;
    direction.current = delta;
    setSelection(current => ({ collection, index: Math.max(0, Math.min(covers.length - 1, (current.collection === collection ? current.index : 0) + delta)), manual: true }));
  }

  if (!game) return null;
  return <div ref={stage} className="cover-stage" role="region" aria-label="Featured games" aria-roledescription="carousel" tabIndex={0}
    onKeyDown={event => {
      if ((event.target as HTMLElement).closest("input, textarea, select, video, audio, [contenteditable]")) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); move(event.key === "ArrowLeft" ? -1 : 1); }
    }}
    onPointerDown={event => {
      suppressClick.current = false;
      if (!event.isPrimary || event.button !== 0 || gesture.current) { gesture.current = null; return; }
      if (!document.hidden && visible.current && !(event.target as HTMLElement).closest("button")) gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    }}
    onPointerCancel={() => { gesture.current = null; }}
    onPointerUp={event => {
      const start = gesture.current;
      gesture.current = null;
      if (!start || start.id !== event.pointerId) return;
      const x = event.clientX - start.x;
      const y = event.clientY - start.y;
      if (Math.abs(x) >= 40 && Math.abs(x) > Math.abs(y)) { suppressClick.current = true; move(x < 0 ? 1 : -1); }
    }}
    onClickCapture={event => { if (suppressClick.current) { event.preventDefault(); event.stopPropagation(); suppressClick.current = false; } }}>
    <div className="cover-stack">
      <div ref={slide} className="cover" role="group" aria-roledescription="slide" aria-label={`${index + 1} of ${covers.length}`}>
        <a href={`/g/${encodeURIComponent(game.id)}`} className="cover-link" aria-label={game.title} draggable={false}>
          <GameArt key={game.id} imageUrl={game.imageUrl} title={game.title} store={game.store} alt="" priority eager sizes="(min-width: 1024px) 520px, 80vw" />
          <span className="cover-caption"><span className="cover-title">{game.title}</span></span>
        </a>
        <div className="cover-labels"><StoreBadge store={game.store} /><Status game={game} state={state} /></div>
      </div>
    </div>
    {covers.length > 1 && <div className="cover-controls">
      <button type="button" className="btn btn-ghost" aria-label="Previous game" disabled={index === 0} onClick={() => move(-1)}>Previous</button>
      <span className="meta">{index + 1} / {covers.length}</span>
      <button type="button" className="btn btn-ghost" aria-label="Next game" disabled={index === covers.length - 1} onClick={() => move(1)}>Next</button>
    </div>}
    <span className="sr-only" aria-live="polite" aria-atomic="true">{selection.manual && selection.collection === collection ? `${game.title}, ${index + 1} of ${covers.length}` : ""}</span>
  </div>;
}
