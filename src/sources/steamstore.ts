import { z } from "zod";
import { safeImageUrl, safeOutboundUrl, steamDeepLink } from "../lib/urls.ts";
import { type GameRow, SourceError } from "./epic.ts";

const appId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const searchSchema = z.object({ success: z.literal(1), results_html: z.string() });
const detailsSchema = z.discriminatedUnion("success", [
  z.object({ success: z.literal(false) }),
  z.object({ success: z.literal(true), data: z.object({
    type: z.string(), steam_appid: appId, name: z.string().min(1), header_image: z.string().optional(),
    price_overview: z.object({ initial: z.number().nonnegative(), discount_percent: z.number().min(0).max(100) }).optional(),
  }) }),
]);

export function parseSteamSearch(json: unknown): number[] {
  const parsed = searchSchema.safeParse(json);
  if (!parsed.success) throw new SourceError("Invalid Steam search payload");
  const ids = [...parsed.data.results_html.matchAll(/\bdata-ds-appid\s*=\s*(["'])(\d+)\1/g)]
    .map((match) => Number(match[2])).filter((id) => appId.safeParse(id).success);
  return [...new Set(ids)];
}

export function parseAppDetails(json: unknown, appid: number): GameRow | null {
  if (!appId.safeParse(appid).success) throw new SourceError("Invalid Steam appid");
  const parsed = z.object({ [String(appid)]: detailsSchema }).safeParse(json);
  if (!parsed.success) throw new SourceError("Invalid Steam appdetails payload");
  const entry = parsed.data[String(appid)];
  if (!entry.success) return null;
  const data = entry.data;
  if (data.steam_appid !== appid) throw new SourceError("Steam appid mismatch");
  if (data.type !== "game" || data.price_overview?.discount_percent !== 100 || data.price_overview.initial <= 0) return null;
  const storeUrl = safeOutboundUrl(`https://store.steampowered.com/app/${appid}/`);
  if (!storeUrl) return null;
  return {
    store: "steam", externalId: String(appid), kind: "free_to_keep", title: data.name,
    storeUrl, claimUrl: steamDeepLink(appid), imageUrl: data.header_image ? safeImageUrl(data.header_image) : null,
    startsAt: null, endsAt: null, upcoming: false,
  };
}

export async function fetchSteamStore(fetchFn: typeof fetch = fetch): Promise<GameRow[]> {
  const request = async (url: string): Promise<unknown> => {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(15000), cache: "no-store" });
    if (!response.ok) throw new SourceError(`Steam store HTTP ${response.status}`);
    if (response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
      throw new SourceError("Steam store response is not JSON");
    }
    return response.json();
  };
  try {
    const ids = parseSteamSearch(await request("https://store.steampowered.com/search/results/?maxprice=free&specials=1&infinite=1&cc=id"));
    const games: GameRow[] = [];
    for (const id of ids) {
      const game = parseAppDetails(await request(`https://store.steampowered.com/api/appdetails?appids=${id}&cc=id`), id);
      if (game) games.push(game);
    }
    return games;
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError("Steam store request failed", { cause: error });
  }
}
