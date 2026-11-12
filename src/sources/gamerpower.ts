import { z } from "zod";
import { sourceJson } from "./http.ts";
import { safeImageUrl, safeOutboundUrl } from "../lib/urls.ts";
import { type GameRow, SourceError } from "./epic.ts";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/).transform((value, ctx) => {
  const iso = `${value.replace(" ", "T")}Z`;
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().replace(".000Z", "Z") !== iso) {
    ctx.addIssue({ code: "custom", message: "Invalid giveaway date" });
    return z.NEVER;
  }
  return timestamp;
});
const schema = z.array(z.object({
  id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  title: z.string().min(1), type: z.string(), status: z.string(),
  gamerpower_url: z.string(), image: z.string(),
  published_date: date, end_date: z.union([z.literal("N/A").transform(() => null), date]),
}));

export function parseGamerPower(json: unknown, now: Date): GameRow[] {
  const parsed = schema.safeParse(json);
  if (!parsed.success || !Number.isFinite(now.getTime())) throw new SourceError("Invalid GamerPower payload or clock");
  const games: GameRow[] = [];
  for (const item of parsed.data) {
    if (item.type !== "Game" || item.status !== "Active" || item.published_date > now.getTime()
      || (item.end_date !== null && item.end_date <= now.getTime())) continue;
    const storeUrl = safeOutboundUrl(item.gamerpower_url);
    if (!storeUrl) continue;
    games.push({
      store: "steam", externalId: String(item.id), kind: "key_giveaway", title: item.title,
      storeUrl, claimUrl: storeUrl, imageUrl: safeImageUrl(item.image),
      startsAt: item.published_date, endsAt: item.end_date, upcoming: false,
    });
  }
  return games;
}

export async function fetchGamerPower(fetchFn: typeof fetch = fetch): Promise<GameRow[]> {
  try {
    return parseGamerPower(await sourceJson("https://www.gamerpower.com/api/giveaways?platform=steam&type=game", fetchFn), new Date());
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError("GamerPower request failed", { cause: error });
  }
}
