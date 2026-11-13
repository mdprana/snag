"use client";

import { cloneElement, useState, type ReactElement, type ReactNode } from "react";

export function ImageWithFallback({ children, fallback }: { children: ReactElement<{ onError?: () => void }>; fallback: ReactNode }): React.ReactNode {
  const [failed, setFailed] = useState(false);
  return failed ? fallback : cloneElement(children, { onError: () => setFailed(true) });
}
