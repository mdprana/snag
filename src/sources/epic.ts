import { z } from "zod";
import { sourceJson } from "./http.ts";
import { parseEpicMetadata, type GameMetadata } from "../lib/metadata.ts";
import { safeImageUrl, safeOutboundUrl } from "../lib/urls.ts";

export type GameRow = {
  store: "epic" | "steam";
  externalId: string;
  kind: "free_to_keep" | "key_giveaway";
  title: string;
  storeUrl: string;
  claimUrl: string;
  imageUrl: string | null;
  startsAt: number | null;
  endsAt: number | null;
  upcoming: boolean;
  metadata?: GameMetadata;
  providerNamespace?: string;
};

export class SourceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "SourceError";
  }
}

const offer = z.object({
  startDate: z.iso.datetime(),
  endDate: z.iso.datetime(),
  discountSetting: z.object({ discountPercentage: z.number() }),
}).refine((value) => Date.parse(value.startDate) < Date.parse(value.endDate), "invalid promotion window");
const groups = z.array(z.object({ promotionalOffers: z.array(offer) }));
const mappings = z.array(z.object({ pageSlug: z.string().nullable().optional() }));
const schema = z.object({
  data: z.object({ Catalog: z.object({ searchStore: z.object({ elements: z.array(z.object({
    id: z.string().min(1),
    namespace: z.string().min(1),
    title: z.string().min(1),
    price: z.object({ totalPrice: z.object({ discountPrice: z.number().nonnegative() }) }),
    promotions: z.object({ promotionalOffers: groups, upcomingPromotionalOffers: groups }).nullable().optional(),
    offerMappings: mappings.nullable().optional(),
    catalogNs: z.object({ mappings: mappings.nullable().optional() }).nullable().optional(),
    productSlug: z.string().nullable().optional(),
    description: z.unknown().optional(), customAttributes: z.unknown().optional(),
    keyImages: z.array(z.object({ type: z.string(), url: z.string() })).max(200),
  })) }) }) }),
});

export function parseEpic(json: unknown, now: Date): GameRow[] {
  const parsed = schema.safeParse(json);
  if (!parsed.success || !Number.isFinite(now.getTime())) throw new SourceError("Invalid Epic payload or clock");
  const games: GameRow[] = [];
  for (const element of parsed.data.data.Catalog.searchStore.elements) {
    const promotions = element.promotions;
    if (!promotions) continue;
    const active = element.price.totalPrice.discountPrice === 0
      ? promotions.promotionalOffers.flatMap((group) => group.promotionalOffers).find((promo) =>
        promo.discountSetting.discountPercentage === 0 && Date.parse(promo.startDate) <= now.getTime() && now.getTime() < Date.parse(promo.endDate))
      : undefined;
    const promo = active ?? promotions.upcomingPromotionalOffers.flatMap((group) => group.promotionalOffers).find((promo) =>
      promo.discountSetting.discountPercentage === 0 && Date.parse(promo.startDate) > now.getTime());
    if (!promo) continue;
    const slug = [
      ...(element.offerMappings ?? []).map((mapping) => mapping.pageSlug),
      ...(element.catalogNs?.mappings ?? []).map((mapping) => mapping.pageSlug),
      element.productSlug,
    ].find((slug) => slug?.trim());
    if (!slug) continue;
    const storeUrl = safeOutboundUrl(`https://store.epicgames.com/en-US/p/${slug}`);
    const claimUrl = safeOutboundUrl(`https://store.epicgames.com/purchase?offers=${encodeURIComponent(`1-${element.namespace}-${element.id}`)}`);
    if (!storeUrl || !claimUrl) continue;
    const image = element.keyImages.find((image) => image.type === "OfferImageWide")
      ?? element.keyImages.find((image) => image.type === "Thumbnail") ?? element.keyImages[0];
    let metadata: GameMetadata | undefined;
    try { metadata = parseEpicMetadata(element, element.id, element.namespace, now.getTime()); } catch {}
    games.push({
      metadata, providerNamespace: element.namespace,
      store: "epic", externalId: element.id, kind: "free_to_keep", title: element.title,
      storeUrl, claimUrl, imageUrl: image ? safeImageUrl(image.url) : null,
      startsAt: Date.parse(promo.startDate), endsAt: Date.parse(promo.endDate), upcoming: !active,
    });
  }
  return games;
}

export async function fetchEpic(fetchFn: typeof fetch = fetch): Promise<GameRow[]> {
  try {
    return parseEpic(await sourceJson("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=ID&allowCountries=ID", fetchFn), new Date());
  } catch (error) {
    if (error instanceof SourceError) throw error;
    throw new SourceError("Epic request failed", { cause: error });
  }
}
