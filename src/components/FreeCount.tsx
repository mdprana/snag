"use client";

import { useEffect, useRef } from "react";
import { animate } from "motion";

export function FreeCount({ count }: { count: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = animate(0, count, { duration: 0.8, ease: "easeOut", onUpdate: (value) => {
      if (ref.current) ref.current.textContent = String(Math.round(value));
    } });
    return () => animation.stop();
  }, [count]);
  return <span aria-label={`${count} free games`} className="landing-count" data-testid="free-count" ref={ref}>{count}</span>;
}
