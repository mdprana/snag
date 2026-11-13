"use client";

import { getImageProps } from "next/image";
import { safeImageUrl } from "@/src/lib/urls";
import { ImageWithFallback } from "./ImageWithFallback";

type Props = { imageUrl: string; fallbackImageUrl?: string; title: string; store: string; alt?: string; sizes?: string; priority?: boolean; eager?: boolean; className?: string };

export function GameArt({ imageUrl, fallbackImageUrl, title, store, alt = title, sizes = "(min-width: 768px) 480px, 90vw", priority = false, eager = priority, className = "" }: Props): React.ReactElement {
  const image = safeImageUrl(imageUrl);
  const fallbackImage = safeImageUrl(fallbackImageUrl ?? "");
  const placeholder = <span role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={`game-art game-art-fallback ${className}`}><span aria-hidden="true">{title.match(/[\p{L}\p{N}]/u)?.[0] ?? ""}</span></span>;
  const imageProps = (src: string) => getImageProps({ src, width: 1280, height: 720, sizes, alt, loading: eager ? "eager" : "lazy", fetchPriority: priority ? "high" : "auto", className: `game-art ${className}` }).props;
  const renderImage = (src: string) => <ImageWithFallback fallback={placeholder}><img {...imageProps(src)} alt={alt} data-store={store} data-testid="game-art-image" style={undefined} /></ImageWithFallback>;
  if (!image) return fallbackImage ? renderImage(fallbackImage) : placeholder;
  return <ImageWithFallback fallback={fallbackImage ? renderImage(fallbackImage) : placeholder}><img {...imageProps(image)} alt={alt} data-store={store} data-testid="game-art-image" style={undefined} /></ImageWithFallback>;
}
