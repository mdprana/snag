"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, inView, stagger } from "motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || element.getBoundingClientRect().top < window.innerHeight) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const items = [...element.children] as HTMLElement[];
    for (const item of items) {
      item.style.opacity = "0";
      if (!reduce) item.style.transform = "translateY(16px)";
    }
    return inView(element, () => {
      const to = reduce ? { opacity: 1 } : { opacity: 1, transform: "translateY(0px)" };
      animate(items.slice(0, 6), to, { duration: reduce ? 0.12 : 0.5, ease: EASE, delay: stagger(0.06) });
      if (items.length > 6) animate(items.slice(6), to, { duration: reduce ? 0.12 : 0.5, ease: EASE, delay: 0.36 });
    }, { amount: 0.15 });
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
