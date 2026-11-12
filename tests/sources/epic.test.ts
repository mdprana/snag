import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/epic-freeGamesPromotions-2026-11-12.json";
import { fetchEpic, parseEpic, SourceError } from "@/src/sources/epic";

const now = new Date("2026-11-12T12:00:00Z");
const base = fixture.data.Catalog.searchStore.elements[0];
const promo = base.promotions!.promotionalOffers[0].promotionalOffers[0];
const payload = (element = structuredClone(base)) => ({ data: { Catalog: { searchStore: { elements: [element] } } } });

afterEach(() => vi.useRealTimers());

describe("Epic parser", () => {
  it("price 0 without active promo is not free", () => {
    const element = structuredClone(base);
    element.promotions = null;
    expect(parseEpic(payload(element), now)).toEqual([]);
    expect(parseEpic(payload(), new Date(promo.endDate))).toEqual([]);
    expect(parseEpic(payload(), new Date("2026-11-01T00:00:00Z"))).toEqual([]);
  });

  it("active promo with discountPercentage 0 is free with checkout url 1-<namespace>-<id>", () => {
    expect(parseEpic(fixture, now).map((game) => game.title)).toEqual([base.title, "Flotsam"]);
    expect(parseEpic(payload(), new Date(promo.startDate))).toEqual([{
      store: "epic", externalId: base.id, kind: "free_to_keep", title: base.title,
      storeUrl: `https://store.epicgames.com/en-US/p/${base.offerMappings[0].pageSlug}`,
      claimUrl: `https://store.epicgames.com/purchase?offers=1-${base.namespace}-${base.id}`,
      imageUrl: base.keyImages[0].url, startsAt: Date.parse(promo.startDate), endsAt: Date.parse(promo.endDate), upcoming: false,
    }]);
  });

  it("requires both zero price and zero discount percentage", () => {
    const element = structuredClone(base);
    element.price.totalPrice.discountPrice = 100;
    expect(parseEpic(payload(element), now)).toEqual([]);
    element.price.totalPrice.discountPrice = 0;
    element.promotions!.promotionalOffers[0].promotionalOffers[0].discountSetting.discountPercentage = 20;
    expect(parseEpic(payload(element), now)).toEqual([]);
  });

  it("upcoming offers flagged upcoming, never free", () => {
    const element = structuredClone(base);
    element.price.totalPrice.discountPrice = 100;
    element.promotions = { promotionalOffers: [], upcomingPromotionalOffers: [{ promotionalOffers: [promo] }] };
    const games = parseEpic(payload(element), new Date("2026-11-01T00:00:00Z"));
    expect(games).toHaveLength(1);
    expect(games[0].upcoming).toBe(true);
    expect(games.filter((game) => !game.upcoming)).toEqual([]);
    expect(parseEpic(payload(element), now)).toEqual([]);
    expect(parseEpic(fixture, now).filter((game) => game.upcoming)).toEqual([]);
  });

  it("slug fallback order offerMappings, catalogNs, productSlug", () => {
    const element = structuredClone(base);
    element.offerMappings = [{ pageSlug: "", pageType: "productHome" }, { pageSlug: "offer", pageType: "productHome" }];
    element.catalogNs.mappings[0].pageSlug = "catalog";
    element.productSlug = "product/home";
    expect(parseEpic(payload(element), now)[0].storeUrl).toBe("https://store.epicgames.com/en-US/p/offer");
    element.offerMappings = [];
    expect(parseEpic(payload(element), now)[0].storeUrl).toBe("https://store.epicgames.com/en-US/p/catalog");
    element.catalogNs.mappings = [];
    expect(parseEpic(payload(element), now)[0].storeUrl).toBe("https://store.epicgames.com/en-US/p/product/home");
    element.productSlug = "";
    expect(parseEpic(payload(element), now)).toEqual([]);
  });

  it("prefers wide image then thumbnail then first, drops unsafe image URLs", () => {
    const element = structuredClone(base);
    element.keyImages = [base.keyImages[1], base.keyImages[2], base.keyImages[0]];
    expect(parseEpic(payload(element), now)[0].imageUrl).toBe(base.keyImages[0].url);
    element.keyImages.pop();
    expect(parseEpic(payload(element), now)[0].imageUrl).toBe(base.keyImages[2].url);
    element.keyImages.pop();
    expect(parseEpic(payload(element), now)[0].imageUrl).toBe(base.keyImages[1].url);
    element.keyImages[0].url = "https://evil.com/image.jpg";
    expect(parseEpic(payload(element), now)[0].imageUrl).toBeNull();
    element.keyImages = [];
    expect(parseEpic(payload(element), now)[0].imageUrl).toBeNull();
  });

  it("validates untrusted payloads and dates", () => {
    expect(() => parseEpic({}, now)).toThrow(SourceError);
    const element = structuredClone(base);
    element.promotions!.promotionalOffers[0].promotionalOffers[0].startDate = "invalid";
    expect(() => parseEpic(payload(element), now)).toThrow(SourceError);
    expect(() => parseEpic(payload(), new Date(NaN))).toThrow(SourceError);
  });
});

describe("Epic fetch", () => {
  it("fetchEpic throws SourceError on HTML response and on 500", async () => {
    for (const response of [new Response("<html/>", { headers: { "content-type": "text/html" } }), new Response("{}", { status: 500, headers: { "content-type": "application/json" } })]) {
      await expect(fetchEpic(vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow(SourceError);
    }
  });

  it("fetches JSON with 15 second timeout and no cache", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(Response.json(fixture));
    expect(await fetchEpic(fetchFn)).toEqual(parseEpic(fixture, now));
    expect(timeout).toHaveBeenCalledWith(15000);
    expect(fetchFn).toHaveBeenCalledWith("https://store-site-backend-static.ak.epicgames.com/freeGamesPromotions?locale=en-US&country=ID&allowCountries=ID", { signal: expect.any(AbortSignal), cache: "no-store" });
    timeout.mockRestore();
  });

  it("wraps network, invalid JSON, and invalid schema failures as SourceError", async () => {
    await expect(fetchEpic(vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")))).rejects.toThrow(SourceError);
    for (const response of [new Response("{", { headers: { "content-type": "application/json" } }), Response.json({})]) {
      await expect(fetchEpic(vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow(SourceError);
    }
  });
});
