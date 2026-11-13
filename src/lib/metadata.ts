import { Parser } from "htmlparser2";
import { z } from "zod";
import type { Client } from "@libsql/client";
import { safeImageUrl, safeTrailerUrl } from "./urls.ts";
import { sourceJson } from "../sources/http.ts";

export const epicMetadataUrl = "https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=ID&allowCountries=ID";
const steamUrl = (id: number) => `https://store.steampowered.com/api/appdetails?appids=${id}&cc=id&l=en`;
const image = z.string().refine(value => safeImageUrl(value) === value);
const fieldNames = ["aboutText", "developer", "publisher", "platforms", "screenshots", "trailer"] as const;
const trailer = z.object({ kind: z.literal("native"), url: z.string(), mimeType: z.literal("application/vnd.apple.mpegurl"), poster: image, title: z.string().min(1).max(200) });
const fieldSource = z.object({ provider: z.enum(["steam", "epic"]), sourceUrl: z.string(), productId: z.string().min(1).max(100), locale: z.enum(["en", "en-US"]), country: z.literal("ID"), fetchedAt: z.number().int().nonnegative() });
const metadataSchema = z.object({
  provider: z.enum(["steam", "epic"]), sourceUrl: z.string(), fetchedAt: z.number().int().nonnegative(),
  locale: z.enum(["en", "en-US"]), country: z.literal("ID"), aboutText: z.string().max(20000), aboutKind: z.enum(["full", "summary"]),
  platforms: z.array(z.enum(["windows", "macos", "linux", "android", "ios"])).max(5).nullable(),
  screenshots: z.array(z.object({ url: image, thumbnailUrl: image })).max(12),
  developer: z.string().max(200).nullable(), publisher: z.string().max(200).nullable(),
  canonicalSteamAppId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
  fieldSources: z.partialRecord(z.enum(fieldNames), fieldSource).optional(),
  trailer: trailer.nullable().optional(),
}).refine(value => !value.trailer || (value.provider === "steam" && value.canonicalSteamAppId !== undefined && safeTrailerUrl(value.trailer.url, value.canonicalSteamAppId) === value.trailer.url))
  .refine(value => value.provider === "epic" ? value.sourceUrl === epicMetadataUrl && value.locale === "en-US" && value.canonicalSteamAppId === undefined : /^https:\/\/store\.steampowered\.com\/api\/appdetails\?appids=[1-9]\d*&cc=id&l=en$/.test(value.sourceUrl) && value.locale === "en" && (value.canonicalSteamAppId === undefined || value.sourceUrl === steamUrl(value.canonicalSteamAppId)))
  .refine(value => Object.values(value.fieldSources ?? {}).every(source => source.provider === value.provider && source.sourceUrl === value.sourceUrl && source.locale === value.locale && source.fetchedAt === value.fetchedAt));
export type GameMetadata = z.infer<typeof metadataSchema>;

function text(html: string, limit = 20000): string {
  let output = "";
  let blocked = 0;
  const discard = new Set(["script", "style", "template", "iframe", "object", "embed", "form", "svg", "math"]);
  const blocks = new Set(["p", "div", "br", "li", "h1", "h2", "h3", "h4"]);
  const parser = new Parser({
    onopentag(name) { if (discard.has(name)) blocked++; if (!blocked && blocks.has(name)) output += "\n\n"; },
    onclosetag(name) { if (discard.has(name)) blocked--; if (!blocked && blocks.has(name)) output += "\n\n"; },
    ontext(value) { if (!blocked && output.length < limit * 2) output += value; },
  }, { decodeEntities: true });
  parser.end(html);
  return output.replace(/[\t\r ]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, limit);
}
const plain = (value: string | undefined) => value ? text(value, 200) || null : null;
function withSources(value: Omit<GameMetadata, "fieldSources">, productId: string): GameMetadata {
  const present = fieldNames.filter(name => name === "platforms" || name === "screenshots" ? !!value[name]?.length : !!value[name]);
  const source = { provider: value.provider, sourceUrl: value.sourceUrl, productId, locale: value.locale, country: value.country, fetchedAt: value.fetchedAt };
  return metadataSchema.parse({ ...value, fieldSources: Object.fromEntries(present.map(name => [name, source])) });
}
function gallery(items: { url: string; thumbnailUrl: string }[]) {
  const seen = new Set<string>();
  return items.filter(item => safeImageUrl(item.url) && safeImageUrl(item.thumbnailUrl) && !seen.has(item.url) && !!seen.add(item.url)).slice(0, 12);
}
function steamTrailer(movies: unknown, id: number): GameMetadata["trailer"] {
  const parsed = z.array(z.object({ name: z.string(), thumbnail: z.string(), hls_h264: z.string().optional(), highlight: z.boolean().optional() })).max(50).safeParse(movies);
  if (!parsed.success) return null;
  const movie = [...parsed.data].sort((a, b) => Number(!!b.highlight) - Number(!!a.highlight))
    .find(item => item.hls_h264 && safeTrailerUrl(item.hls_h264, id) === item.hls_h264 && safeImageUrl(item.thumbnail) === item.thumbnail);
  return movie ? { kind: "native", url: movie.hls_h264!, mimeType: "application/vnd.apple.mpegurl", poster: movie.thumbnail, title: plain(movie.name) ?? "Trailer" } : null;
}
export function parseSteamMetadata(json: unknown, id: number, now: number, expectedName?: string): GameMetadata {
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER).parse(id);
  const data = z.object({ [String(id)]: z.object({ success: z.literal(true), data: z.object({
    steam_appid: z.literal(id), type: z.literal("game"), name: expectedName === undefined ? z.string().optional() : z.literal(expectedName), about_the_game: z.string().optional(), detailed_description: z.string().optional(), short_description: z.string().optional(),
    platforms: z.object({ windows: z.boolean(), mac: z.boolean(), linux: z.boolean() }).optional(),
    screenshots: z.array(z.object({ path_full: z.string(), path_thumbnail: z.string() })).max(200).optional(),
    developers: z.array(z.string()).max(100).optional(), publishers: z.array(z.string()).max(100).optional(), movies: z.unknown().optional(),
  }) }) }).parse(json)[String(id)].data;
  const full = data.about_the_game || data.detailed_description;
  return withSources({ provider: "steam", sourceUrl: steamUrl(id), fetchedAt: now, locale: "en", country: "ID", canonicalSteamAppId: id, aboutText: text(full || data.short_description || ""), aboutKind: full ? "full" : "summary",
    platforms: data.platforms ? (["windows", "macos", "linux"] as const).filter((_, i) => [data.platforms!.windows, data.platforms!.mac, data.platforms!.linux][i]) : null,
    screenshots: gallery((data.screenshots ?? []).map(item => ({ url: item.path_full, thumbnailUrl: item.path_thumbnail }))), developer: plain(data.developers?.join(", ")), publisher: plain(data.publishers?.join(", ")), trailer: steamTrailer(data.movies, id) }, String(id));
}
export function parseEpicMetadata(json: unknown, id: string, namespace: string, now: number): GameMetadata {
  const data = z.object({ id: z.literal(id), namespace: z.literal(namespace), description: z.string().optional(), keyImages: z.array(z.object({ type: z.string(), url: z.string() })).max(200), customAttributes: z.array(z.object({ key: z.string(), value: z.string() })).max(200).optional() }).parse(json);
  return withSources({ provider: "epic", sourceUrl: epicMetadataUrl, fetchedAt: now, locale: "en-US", country: "ID", aboutText: text(data.description ?? ""), aboutKind: "summary", platforms: null,
    screenshots: gallery(data.keyImages.filter(item => ["featuredMedia", "GalleryImage"].includes(item.type)).map(item => ({ url: item.url, thumbnailUrl: item.url }))),
    developer: plain(data.customAttributes?.find(item => item.key === "developerName")?.value), publisher: plain(data.customAttributes?.find(item => item.key === "publisherName")?.value) }, `${namespace}:${id}`);
}
export function decodeMetadata(payload: unknown): GameMetadata | null {
  if (typeof payload !== "string" || Buffer.byteLength(payload) > 131072) return null;
  try {
    const value = JSON.parse(payload);
    const valid = metadataSchema.safeParse(value);
    if (valid.success) return valid.data;
    if (value && typeof value === "object" && Object.hasOwn(value, "trailer")) {
      const sources = { ...value.fieldSources };
      delete sources.trailer;
      return metadataSchema.parse({ ...value, trailer: null, fieldSources: value.fieldSources ? sources : undefined });
    }
    return null;
  } catch { return null; }
}
export async function readMetadata(db: Client, id: string): Promise<GameMetadata | null> {
  const result = await db.execute({ sql: "SELECT payload_json FROM game_metadata WHERE game_id=?", args: [id] });
  return decodeMetadata(result.rows[0]?.payload_json);
}

export async function readMetadataRecord(db: Client, id: string): Promise<{ metadata: GameMetadata | null; attemptedAt: number | null; errorCode: string | null }> {
  const result = await db.execute({ sql: "SELECT payload_json, attempted_at, error_code FROM game_metadata WHERE game_id=?", args: [id] });
  const row = result.rows[0];
  return { metadata: decodeMetadata(row?.payload_json), attemptedAt: row?.attempted_at == null ? null : Number(row.attempted_at), errorCode: row?.error_code == null ? null : String(row.error_code) };
}
export async function saveMetadata(db: Client, id: string, provider: "steam" | "epic", namespace: string | null, payload: GameMetadata | null, now: number, error: string | null = null): Promise<void> {
  const json = payload ? JSON.stringify(metadataSchema.parse(payload)) : null;
  if (json && Buffer.byteLength(json) > 131072) throw new Error("Metadata too large");
  await db.execute({ sql: `INSERT INTO game_metadata(game_id,provider,provider_namespace,payload_json,fetched_at,attempted_at,error_code) VALUES(?,?,?,?,?,?,?)
    ON CONFLICT(game_id) DO UPDATE SET provider_namespace=COALESCE(excluded.provider_namespace,game_metadata.provider_namespace), payload_json=COALESCE(excluded.payload_json,game_metadata.payload_json), fetched_at=COALESCE(excluded.fetched_at,game_metadata.fetched_at), attempted_at=excluded.attempted_at,error_code=excluded.error_code`, args: [id, provider, namespace, json, payload?.fetchedAt ?? null, now, error] });
}
// GamerPower IDs are not Steam app IDs. Each entry was verified against the live giveaway destination and Steam appdetails.
const keyGiveawaySteamApps: Record<string, { title: string; appId: number; name: string }> = {
  "3716": { title: "Dwarven Realms (Steam) Key Giveaway", appId: 2015240, name: "Dwarven Realms" },
};
function steamIdentity(row: Record<string, unknown>): { id: number; name?: string } {
  if (row.kind === "free_to_keep") {
    if (!/^[1-9]\d*$/.test(String(row.external_id)) || !Number.isSafeInteger(Number(row.external_id))) throw new Error("identity");
    return { id: Number(row.external_id) };
  }
  for (const url of [row.store_url, row.claim_url]) {
    const match = /^https:\/\/store\.steampowered\.com\/app\/([1-9]\d{0,15})(?:\/|$)/.exec(String(url ?? ""));
    if (match && Number.isSafeInteger(Number(match[1]))) return { id: Number(match[1]) };
  }
  const mapped = Object.hasOwn(keyGiveawaySteamApps, String(row.external_id)) ? keyGiveawaySteamApps[String(row.external_id)] : undefined;
  if (mapped && mapped.title === row.title) return { id: mapped.appId, name: mapped.name };
  throw new Error("identity");
}
export async function refreshSteamMetadata(db: Client, fetchFn: typeof fetch, now: number): Promise<void> {
  const rows = await db.execute({ sql: `SELECT g.id,g.external_id,g.kind,g.title,g.store_url,g.claim_url FROM games g LEFT JOIN game_metadata m ON m.game_id=g.id WHERE g.store='steam' AND g.kind IN ('free_to_keep','key_giveaway') AND (m.attempted_at IS NULL OR (m.attempted_at<=? AND (m.fetched_at IS NULL OR m.fetched_at<=?))) ORDER BY CASE WHEN g.ends_at IS NULL OR g.ends_at>? THEN 0 ELSE 1 END,g.first_seen_at DESC LIMIT 10`, args: [now - 3600000, now - 86400000, now] });
  const budget = AbortSignal.timeout(20000);
  let cursor = 0;
  const worker = async () => {
    while (cursor < rows.rows.length && !budget.aborted) {
      const row = rows.rows[cursor++];
      try {
        const { id, name } = steamIdentity(row);
        const json = await sourceJson(steamUrl(id), fetchFn, AbortSignal.any([budget, AbortSignal.timeout(5000)]));
        await saveMetadata(db, String(row.id), "steam", null, parseSteamMetadata(json, id, now, name), now);
      } catch {
        await saveMetadata(db, String(row.id), "steam", null, null, now, "upstream").catch(() => {});
      }
    }
  };
  await Promise.all([worker(), worker()]);
}
