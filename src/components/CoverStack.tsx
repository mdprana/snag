"use client";

import { useEffect, useRef } from "react";
import { animate, inView } from "motion";
import type { FeedGame } from "@/src/lib/games";
import { GameArt } from "./GameArt";
import { EASE } from "./Reveal";

export function CoverStack({ games }: { games: FeedGame[] }): React.ReactElement {
  const stage = useRef<HTMLDivElement>(null);
  const floater = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = stage.current;
    const float = floater.current;
    if (!element || !float || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const stopView = inView(float, () => {
      const loop = animate(float, { transform: ["translateY(0px)", "translateY(-3px)"] }, { duration: 1.2, ease: EASE, repeat: 3, repeatType: "mirror" });
      return () => { loop.stop(); float.style.transform = ""; };
    });
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return stopView;
    const move = (event: PointerEvent) => {
      const box = element.getBoundingClientRect();
      element.style.setProperty("--tilt-x", `${((event.clientY - box.top) / box.height - 0.5) * -10}deg`);
      element.style.setProperty("--tilt-y", `${((event.clientX - box.left) / box.width - 0.5) * 14}deg`);
    };
    const leave = () => { element.style.removeProperty("--tilt-x"); element.style.removeProperty("--tilt-y"); };
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerleave", leave);
    return () => { stopView(); element.removeEventListener("pointermove", move); element.removeEventListener("pointerleave", leave); };
  }, []);
  const covers = games.slice(0, 3);
  return <div ref={stage} className="cover-stage" data-count={covers.length}>
    <div ref={floater} className="cover-float">
      <ul className="cover-stack" aria-label="Free to keep right now">
        {covers.map((game, index) => <li key={game.id} className="cover">
          <a href={`/g/${encodeURIComponent(game.id)}`} className="cover-link" aria-label={game.title}>
            <GameArt imageUrl={game.imageUrl} title={game.title} store={game.store} alt="" priority={index === 0} eager sizes="(min-width: 1024px) 520px, 80vw" />
            <span className="cover-caption"><span className="cover-title">{game.title}</span><span className="badge">{game.store === "epic" ? "Epic" : "Steam"}</span></span>
          </a>
        </li>)}
      </ul>
    </div>
  </div>;
}
