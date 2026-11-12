"use client";

import { cloneElement, useState, type ReactElement } from "react";

type ImageProps = { alt?: string; "data-store"?: string; onError?: () => void };

export function ImageWithFallback({ children }: { children: ReactElement<ImageProps> }): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const { alt, "data-store": store } = children.props;
  return failed ? <span className="game-art game-art-fallback" role={alt ? "img" : undefined} aria-label={alt || undefined}><span>Cover unavailable</span><strong>{store === "epic" ? "Epic" : "Steam"}</strong></span> : cloneElement(children, { onError: () => setFailed(true) });
}
