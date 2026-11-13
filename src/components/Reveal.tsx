"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { animate, inView, stagger } from "motion";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || element.getBoundingClientRect().top < window.innerHeight) return;
    const items = [...element.children] as HTMLElement[];
    for (const item of items) item.classList.add("reveal-item");
    return inView(element, () => {
      const to = { opacity: [0, 1], transform: ["translateY(16px)", "translateY(0px)"] };
      const done = () => { for (const item of items) item.classList.remove("reveal-item"); };
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return done();
      const first = animate(items.slice(0, 6), to, { duration: 0.5, ease: EASE, delay: stagger(0.06) });
      const rest = items.length > 6 ? animate(items.slice(6), to, { duration: 0.5, ease: EASE, delay: 0.36 }) : null;
      Promise.all([first, rest]).then(done);
    }, { amount: 0.15 });
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
