import { getImageProps } from "next/image";
import { safeImageUrl } from "@/src/lib/urls";
import { ImageWithFallback } from "./ImageWithFallback";

type Props = { imageUrl: string; title: string; store: string; alt?: string; sizes?: string; priority?: boolean; eager?: boolean; className?: string };

export function GameArt({ imageUrl, title, store, alt = title, sizes = "(min-width: 768px) 480px, 90vw", priority = false, eager = priority, className = "" }: Props): React.ReactElement {
  const image = safeImageUrl(imageUrl);
  if (image) {
    const { props } = getImageProps({ src: image, width: 1280, height: 720, sizes, alt, loading: eager ? "eager" : "lazy", fetchPriority: priority ? "high" : "auto", className: `game-art ${className}` });
    return <ImageWithFallback><img {...props} alt={alt} data-store={store} style={undefined} /></ImageWithFallback>;
  }
  return <div role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={alt ? undefined : true} className={`game-art game-art-fallback ${className}`}><span>Cover unavailable</span><strong>{store === "epic" ? "Epic" : "Steam"}</strong></div>;
}
