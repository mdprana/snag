import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/src/lib/db";
import { listFeed } from "@/src/lib/games";
import { safeImageUrl } from "@/src/lib/urls";

export const alt = "Snag: free games on Epic and Steam";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const fontData = readFile(join(process.cwd(), "assets/fonts/Saira-SemiBold.ttf"));
const logoSvg = readFile(join(process.cwd(), "public/logo.svg"), "utf8").then(svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);

async function loadImage(url: string): Promise<string | null> {
  const safe = safeImageUrl(url);
  if (!safe) return null;
  try {
    const response = await fetch(safe, { signal: AbortSignal.timeout(5000), redirect: "error" });
    if (!response.ok || !response.body) return null;
    const ct = response.headers.get("content-type")?.split(";")[0].trim();
    if (!ct || !["image/jpeg", "image/png", "image/webp"].includes(ct)) { await response.body.cancel(); return null; }
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 2097152) { await reader.cancel(); return null; }
      chunks.push(value);
    }
    return `data:${ct};base64,${Buffer.concat(chunks).toString("base64")}`;
  } catch { return null; }
}

export default async function Image() {
  const [font, logo] = await Promise.all([fontData, logoSvg]);
  let covers: { src: string; store: string }[] = [];
  let count = 0;
  try {
    const feed = await listFeed(db(), undefined, new Date());
    count = feed.freeNow.length;
    const candidates = feed.freeNow.filter(g => g.imageUrl).slice(0, 3);
    const loaded = await Promise.all(candidates.map(async g => {
      const src = await loadImage(g.imageUrl);
      return src ? { src, store: g.store } : null;
    }));
    covers = loaded.filter((c): c is { src: string; store: string } => c !== null);
  } catch {}

  const storeLabel = (store: string) => store === "epic" ? "Epic" : "Steam";

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#0b0a09", padding: "60px", fontFamily: "Saira" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", flex: 1 }}>
          <img src={logo} height={40} alt="" />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ fontSize: 44, color: "#e7e0d6", lineHeight: 1.1 }}>Good games.</div>
            <div style={{ fontSize: 44, color: "#e7e0d6", lineHeight: 1.1 }}>Zero price tag.</div>
          </div>
          <div style={{ fontSize: 20, color: "#a39b90" }}>
            {count > 0 ? `${count} game${count !== 1 ? "s" : ""} free to keep right now` : "Epic and Steam offers, one tap to claim"}
          </div>
        </div>
        {covers.length > 0 && (
          <div style={{ display: "flex", position: "relative", width: 480, height: "100%", alignItems: "center", justifyContent: "center" }}>
            {covers.map((c, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", position: "absolute", width: 300, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", transform: `rotate(${i === 0 ? -6 : i === 1 ? 2 : 8}deg) translate(${i * 50 - 50}px, ${i * 20 - 20}px)` }}>
                <img src={c.src} width={300} height={169} style={{ objectFit: "cover" }} alt="" />
                <div style={{ display: "flex", padding: "8px 12px", backgroundColor: "#161412", color: "#a39b90", fontSize: 14 }}>{storeLabel(c.store)}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", position: "absolute", right: 60, bottom: 60, width: 48, height: 4, backgroundColor: "#EF9256", borderRadius: 2 }} />
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Saira", data: await font, style: "normal" as const, weight: 600 }],
      headers: { "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400" },
    }
  );
}
