import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { db } from "@/src/lib/db";
import { getGame } from "@/src/lib/games";
import { readMetadata } from "@/src/lib/metadata";
import { safeImageUrl } from "@/src/lib/urls";
import { offerState } from "@/src/lib/offers";

export const alt = "Game on Snag";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const runtime = "nodejs";

const fontData = readFile(join(process.cwd(), "assets/fonts/Saira-SemiBold.ttf"));
const logoSvg = readFile(join(process.cwd(), "public/logo.svg"), "utf8").then(svg => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);

const storeNames: Record<string, string> = { epic: "Epic Games Store", steam: "Steam" };

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

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const [font, logo, { id }] = await Promise.all([fontData, logoSvg, params]);
  const game = await getGame(db(), id);

  if (!game) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#0b0a09", alignItems: "center", justifyContent: "center", fontFamily: "Saira" }}>
          <img src={logo} height={48} alt="" />
        </div>
      ),
      { ...size, fonts: [{ name: "Saira", data: await font, style: "normal" as const, weight: 600 }], headers: { "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400" } }
    );
  }

  const metadata = await readMetadata(db(), game.id);
  const artUrl = game.imageUrl || metadata?.screenshots[0]?.url || "";
  const art = artUrl ? await loadImage(artUrl) : null;
  const storeName = storeNames[game.store] || (game.kind === "key_giveaway" ? "Key giveaway" : game.store);
  const state = offerState(game, Date.now());
  const status = state === "ended" ? "Offer ended" : state === "upcoming" ? "Coming soon" : state === "unconfirmed" ? "Availability unconfirmed" : game.kind === "key_giveaway" ? "Key giveaway" : "Free to keep";
  const endsAt = game.endsAt ? new Date(game.endsAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC" : null;

  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#0b0a09", fontFamily: "Saira" }}>
        {art && <img src={art} width={600} height={630} style={{ objectFit: "cover" }} alt="" />}
        <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: art ? "48px 48px 48px 48px" : "60px", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ fontSize: 36, color: "#e7e0d6", lineHeight: 1.15 }}>{game.title}</div>
            <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
              <div style={{ fontSize: 18, color: "#a39b90" }}>{storeName}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#7bd389" }} />
              <div style={{ fontSize: 20, color: "#e7e0d6" }}>{status}</div>
            </div>
            {endsAt && <div style={{ display: "flex", fontSize: 16, color: "#a39b90" }}>{`${state === "ended" ? "Ended" : "Ends"} ${endsAt}`}</div>}
          </div>
          <img src={logo} height={28} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Saira", data: await font, style: "normal" as const, weight: 600 }],
      headers: { "Cache-Control": "public, max-age=0, s-maxage=1800, stale-while-revalidate=86400" },
    }
  );
}
