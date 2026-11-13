"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function DetailBar({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      element.closest("main")?.style.setProperty("--claim-bar-space", `${element.getBoundingClientRect().height}px`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="detail-bar">{children}</div>;
}
