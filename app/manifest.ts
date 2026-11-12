import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return { name: "Snag", display: "standalone", start_url: "/feed", theme_color: "#0b0a09", icons: [{ src: "/logo.svg", sizes: "192x192", type: "image/svg+xml" }, { src: "/logo.svg", sizes: "512x512", type: "image/svg+xml" }] };
}
