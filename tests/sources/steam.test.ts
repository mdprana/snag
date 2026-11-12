import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "../fixtures/gamerpower-steam-2026-11-12.json";
import details from "../fixtures/steam/appdetails.json";
import { SourceError } from "@/src/sources/epic";
import { fetchGamerPower, parseGamerPower } from "@/src/sources/gamerpower";
import { fetchSteamStore, parseAppDetails, parseSteamSearch } from "@/src/sources/steamstore";

const now = new Date("2026-11-12T12:00:00Z");
const base = fixture[0];
const search = { success: 1, results_html: '<a data-ds-appid="123"></a>' };
afterEach(() => vi.useRealTimers());

describe("GamerPower", () => {
  it("gamerpower uses gamerpower_url not open url", () => {
    expect(parseGamerPower(fixture, now)).toEqual([{
      store: "steam", externalId: String(base.id), kind: "key_giveaway", title: base.title,
      storeUrl: base.gamerpower_url, claimUrl: base.gamerpower_url, imageUrl: base.image,
      startsAt: Date.parse("2026-07-16T13:15:06Z"), endsAt: null, upcoming: false,
    }]);
  });

  it("gamerpower non-game types dropped", () => {
    for (const type of ["DLC", "Early Access", "Loot"]) {
      expect(parseGamerPower([{ ...base, type }], now)).toEqual([]);
    }
  });

  it("drops inactive, expired and future giveaways", () => {
    expect(parseGamerPower([{ ...base, status: "Expired" }], now)).toEqual([]);
    expect(parseGamerPower([{ ...base, end_date: "2026-11-12 12:00:00" }], now)).toEqual([]);
    expect(parseGamerPower([{ ...base, published_date: "2026-11-13 12:00:00" }], now)).toEqual([]);
    expect(parseGamerPower([{ ...base, end_date: "2026-11-13 12:00:00" }], now)[0].endsAt).toBe(Date.parse("2026-11-13T12:00:00Z"));
  });

  it("guards links and images and rejects invalid payloads and dates", () => {
    for (const gamerpower_url of [base.open_giveaway_url, "https://evil.com/game", "javascript:alert(1)"]) {
      expect(parseGamerPower([{ ...base, gamerpower_url }], now)).toEqual([]);
    }
    expect(parseGamerPower([{ ...base, image: "https://evil.com/image" }], now)[0].imageUrl).toBeNull();
    for (const json of [{}, [{ ...base, id: -1 }], [{ ...base, end_date: "bad" }], [{ ...base, published_date: "2026-02-30 12:00:00" }]]) {
      expect(() => parseGamerPower(json, now)).toThrow(SourceError);
    }
    expect(() => parseGamerPower(fixture, new Date(NaN))).toThrow(SourceError);
  });
});

describe("Steam store", () => {
  it("parses unique numeric appids without trusting HTML or bundle ids", () => {
    expect(parseSteamSearch({ success: 1, results_html: `<a data-ds-appid="123"></a><a data-ds-appid='456'></a><a data-ds-appid="123"></a><a data-ds-appid="1,2"></a><a data-ds-appid="0"></a><a data-ds-appid="9007199254740992"></a><a data-ds-appid="123x"></a><a data-ds-packageid="789"></a>` })).toEqual([123, 456]);
    expect(parseSteamSearch({ success: 1, results_html: "" })).toEqual([]);
    for (const json of [{}, { success: 0, results_html: "" }, { results_html: 42 }]) {
      expect(() => parseSteamSearch(json)).toThrow(SourceError);
    }
  });

  it("appdetails 100 percent off paid game kept", () => {
    expect(parseAppDetails(details, 123)).toEqual({
      store: "steam", externalId: "123", kind: "free_to_keep", title: "Paid game",
      storeUrl: "https://store.steampowered.com/app/123/", claimUrl: "steam://store/123",
      imageUrl: details[123].data.header_image, startsAt: null, endsAt: null, upcoming: false,
    });
  });

  it("free-to-play (initial 0) dropped", () => {
    const json = structuredClone(details);
    json[123].data.price_overview.initial = 0;
    expect(parseAppDetails(json, 123)).toBeNull();
    delete (json[123].data as { price_overview?: unknown }).price_overview;
    expect(parseAppDetails(json, 123)).toBeNull();
  });

  it("DLC type dropped", () => {
    const json = structuredClone(details);
    json[123].data.type = "dlc";
    expect(parseAppDetails(json, 123)).toBeNull();
  });

  it("rejects non-giveaways, failed details and mismatched appids", () => {
    const json = structuredClone(details);
    json[123].data.price_overview.discount_percent = 99;
    expect(parseAppDetails(json, 123)).toBeNull();
    expect(parseAppDetails({ 123: { success: false } }, 123)).toBeNull();
    expect(() => parseAppDetails(details, 456)).toThrow(SourceError);
    expect(() => parseAppDetails(details, -1)).toThrow(SourceError);
    json[123].data.steam_appid = 456;
    expect(() => parseAppDetails(json, 123)).toThrow(SourceError);
  });

  it("drops unsafe Steam images", () => {
    const json = structuredClone(details);
    json[123].data.header_image = "https://evil.com/image";
    expect(parseAppDetails(json, 123)?.imageUrl).toBeNull();
  });
});

describe("Steam source requests", () => {
  it("fetches both sources with 15 second timeouts and no cache", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(fixture)).mockResolvedValueOnce(Response.json(search)).mockResolvedValueOnce(Response.json(details));
    expect(await fetchGamerPower(fetchFn)).toEqual(parseGamerPower(fixture, now));
    expect(await fetchSteamStore(fetchFn)).toEqual([parseAppDetails(details, 123)]);
    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([
      "https://www.gamerpower.com/api/giveaways?platform=steam&type=game",
      "https://store.steampowered.com/search/results/?maxprice=free&specials=1&infinite=1&cc=id",
      "https://store.steampowered.com/api/appdetails?appids=123&cc=id",
    ]);
    for (const [, options] of fetchFn.mock.calls) expect(options).toEqual({ signal: expect.any(AbortSignal), cache: "no-store" });
    expect(timeout).toHaveBeenCalledTimes(3);
    expect(timeout).toHaveBeenCalledWith(15000);
    timeout.mockRestore();
  });

  it("wraps HTTP, HTML, malformed JSON, schema and network failures as SourceError", async () => {
    for (const source of [fetchGamerPower, fetchSteamStore]) {
      for (const response of [new Response("{}", { status: 500 }), new Response("<html/>", { headers: { "content-type": "text/html" } }), new Response("{", { headers: { "content-type": "application/json" } }), Response.json({})]) {
        await expect(source(vi.fn<typeof fetch>().mockResolvedValue(response))).rejects.toThrow(SourceError);
      }
      await expect(source(vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")))).rejects.toThrow(SourceError);
    }
  });

  it("skips entire Steam store cycle when appdetails fails", async () => {
    for (const response of [new Response("{}", { status: 500 }), new Response("<html/>", { headers: { "content-type": "text/html" } })]) {
      await expect(fetchSteamStore(vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(search)).mockResolvedValueOnce(response))).rejects.toThrow(SourceError);
    }
  });

  it("steam store failure does not throw out of fetchAll", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).startsWith("https://www.gamerpower.com/api/")) return Response.json(fixture);
      return new Response("blocked", { status: 403 });
    });
    const fetchAll = async () => (await Promise.allSettled([fetchGamerPower(fetchFn), fetchSteamStore(fetchFn)]))
      .flatMap((result) => result.status === "fulfilled" ? result.value : []);
    expect(await fetchAll()).toEqual(parseGamerPower(fixture, now));
  });
});
