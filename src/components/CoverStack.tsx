"use client";

import { useEffect, useRef } from "react";
import { animate, inView, stagger } from "motion";
import type { FeedGame } from "@/src/lib/games";
import type { HeroState } from "@/src/lib/hero";
import { UtcTime } from "./Countdown";
import { GameArt } from "./GameArt";
import { EASE } from "./Reveal";
import { PlatformLabels, StoreBadge } from "./StoreBadge";

const listLabel: Record<string, string> = { active: "Free to keep right now", upcoming: "Coming next", archive: "Previously free" };

function Status({ game, state }: { game: FeedGame; state: HeroState }): React.ReactElement | null {
  if (state === "upcoming" && game.startsAt) return <span className="cover-status">Starts <UtcTime at={game.startsAt} /></span>;
  return state === "archive" ? <span className="cover-status">Previously free</span> : null;
}

export function CoverStack({ games, state = "active" }: { games: FeedGame[]; state?: HeroState }): React.ReactElement {
  const stage = useRef<HTMLDivElement>(null);
  const floater = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = stage.current;
    const float = floater.current;
    if (!element || !float) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fans = [...element.querySelectorAll<HTMLElement>(".cover-fan")];
    const entrance = reduce
      ? animate(fans, { opacity: [0, 1] }, { duration: 0.12, ease: EASE })
      : animate(fans, { opacity: [0, 1], transform: ["translateX(-32px) rotate(-6deg) scale(0.94)", "translateX(0px) rotate(0deg) scale(1)"] }, { duration: 0.9, ease: EASE, delay: stagger(0.1, { startDelay: 0.15 }) });
    if (reduce) return () => entrance.stop();
    const stopView = inView(float, () => {
      const loop = animate(float, { transform: ["translateY(0px)", "translateY(-3px)"] }, { duration: 1.2, ease: EASE, repeat: 3, repeatType: "mirror" });
      return () => { loop.stop(); float.style.transform = ""; };
    });
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return () => { entrance.stop(); stopView(); };
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      element.style.setProperty("--tilt-x", `${((event.clientY - box.top) / box.height - 0.5) * -10}deg`);
      element.style.setProperty("--tilt-y", `${((event.clientX - box.left) / box.width - 0.5) * 14}deg`);
    };
    const leave = () => { element.style.removeProperty("--tilt-x"); element.style.removeProperty("--tilt-y"); };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => { entrance.stop(); stopView(); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave); };
  }, []);
  const covers = games.slice(0, 3);
  return <div ref={stage} className="cover-stage" data-count={covers.length}>
    <div ref={floater} className="cover-float">
      <ul className="cover-stack" aria-label={listLabel[state] ?? listLabel.active}>
        {covers.map((game, index) => <li key={game.id} className="cover">
          <div className="cover-fan">
            <a href={`/g/${encodeURIComponent(game.id)}`} className="cover-link" aria-label={game.title}>
              <GameArt imageUrl={game.imageUrl} title={game.title} store={game.store} alt="" priority={index === 0} eager sizes="(min-width: 1024px) 520px, 80vw" />
              <span className="cover-caption"><span className="cover-title">{game.title}</span></span>
            </a>
            <div className="cover-labels"><StoreBadge store={game.store} /><PlatformLabels platforms={game.platforms} /><Status game={game} state={state} /></div>
          </div>
        </li>)}
      </ul>
    </div>
  </div>;
}
