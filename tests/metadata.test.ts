import { expect, it } from "vitest";
import { testDb } from "./helpers/db";
import { parseSteamMetadata, parseEpicMetadata, readMetadata, saveMetadata, refreshSteamMetadata, decodeMetadata } from "@/src/lib/metadata";

const steam = { "123": { success: true, data: { steam_appid: 123, type: "game", about_the_game: '<p>Hello &amp; world</p><script>bad()</script><svg><text>bad</text></svg><p>Next<img src="https://evil.test/x"></p>', platforms: { windows: true, mac: false, linux: true }, screenshots: [{ path_full: "https://shared.akamai.steamstatic.com/one.jpg", path_thumbnail: "https://shared.akamai.steamstatic.com/small.jpg" }], developers: ["Studio"], publishers: ["Publisher"] } } };
it("extracts inert official Steam text, native platforms and provenance without discount requirement", () => {
  const metadata = parseSteamMetadata(steam, 123, 100);
  expect(metadata.aboutText).toBe("Hello & world\n\nNext");
  expect(metadata.platforms).toEqual(["windows", "linux"]);
  expect(metadata.screenshots).toHaveLength(1);
  expect(metadata.sourceUrl).toBe("https://store.steampowered.com/api/appdetails?appids=123&cc=id&l=en");
  expect(() => parseSteamMetadata(steam, 124, 100)).toThrow();
});
it("Epic identity is exact, platforms unknown, gallery excludes covers and videos", () => {
  const element = { id: "offer", namespace: "ns", description: "Store summary", keyImages: [{ type: "featuredMedia", url: "https://cdn1.epicgames.com/shot.jpg" }, { type: "GalleryImage", url: "com.epicgames.video://x" }, { type: "OfferImageWide", url: "https://cdn1.epicgames.com/cover.jpg" }], customAttributes: [{ key: "developerName", value: "Dev" }] };
  const result = parseEpicMetadata(element, "offer", "ns", 100);
  expect(result.platforms).toBeNull();
  expect(result.screenshots.map(s => s.url)).toEqual(["https://cdn1.epicgames.com/shot.jpg"]);
  expect(result.aboutKind).toBe("summary");
  expect(() => parseEpicMetadata(element, "offer", "wrong", 100)).toThrow();
});
it("cache preserves valid payload/fetched time on refresh failure and rejects corrupt/oversize reads", async () => {
  const db = await testDb();
  await db.execute("INSERT INTO games(id,store,external_id,kind,title) VALUES('g','steam','123','free_to_keep','G')");
  const metadata = parseSteamMetadata(steam, 123, 100);
  await saveMetadata(db, "g", "steam", null, metadata, 100);
  await saveMetadata(db, "g", "steam", null, null, 200, "upstream");
  expect((await readMetadata(db, "g"))?.fetchedAt).toBe(100);
  expect((await db.execute("SELECT attempted_at,error_code FROM game_metadata")).rows[0]).toMatchObject({ attempted_at: 200, error_code: "upstream" });
  await db.execute("UPDATE game_metadata SET payload_json='not json'");
  expect(await readMetadata(db, "g")).toBeNull();
  await db.execute({ sql: "UPDATE game_metadata SET payload_json=?", args: [" ".repeat(131073)] });
  expect(await readMetadata(db, "g")).toBeNull();
  await db.execute("DELETE FROM games WHERE id='g'");
  expect((await db.execute("SELECT * FROM game_metadata")).rows).toHaveLength(0);
  db.close();
});
it("refresh never treats GamerPower ID as app ID and retains stale cache on redirect/oversize/429", async () => {
  for (const response of [new Response(null, { status: 302 }), new Response(" ".repeat(1048577), { headers: { "content-type": "application/json" } }), new Response(null, { status: 429 })]) {
    const db = await testDb();
    await db.execute("INSERT INTO games(id,store,external_id,kind,title) VALUES('g','steam','123','free_to_keep','G'),('key','steam','999','key_giveaway','Key')");
    await saveMetadata(db, "g", "steam", null, parseSteamMetadata(steam, 123, 1), 1);
    const urls: string[] = [];
    await refreshSteamMetadata(db, async (url, options) => { urls.push(String(url)); expect(options?.redirect).toBe("error"); return response; }, 90000000);
    expect(urls).toEqual(["https://store.steampowered.com/api/appdetails?appids=123&cc=id&l=en"]);
    expect((await readMetadata(db, "g"))?.fetchedAt).toBe(1);
    await refreshSteamMetadata(db, async () => { throw new Error("retry too soon"); }, 90000001);
    expect((await db.execute("SELECT attempted_at FROM game_metadata")).rows[0].attempted_at).toBe(90000000);
    db.close();
  }
});

const dwarven = { "2015240": { success: true, data: { steam_appid: 2015240, type: "game", name: "Dwarven Realms", short_description: "Face massive hordes.", developers: ["Crater Studios"], publishers: ["Crater Studios"], platforms: { windows: true, mac: false, linux: false } } } };
const json = (body: unknown) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
it("key giveaways enrich only from a Steam app link or exact verified mapping, with field provenance", async () => {
  const db = await testDb();
  await db.execute(`INSERT INTO games(id,store,external_id,kind,title,store_url,claim_url) VALUES
    ('dw','steam','3716','key_giveaway','Dwarven Realms (Steam) Key Giveaway','https://www.gamerpower.com/dwarven-realms-steam-key-giveaway','https://www.gamerpower.com/dwarven-realms-steam-key-giveaway'),
    ('link','steam','5000','key_giveaway','Linked Key Giveaway','https://store.steampowered.com/app/123/Linked/','https://www.gamerpower.com/linked'),
    ('fake','steam','3717','key_giveaway','Other Game Key Giveaway','https://www.gamerpower.com/other','https://www.gamerpower.com/other'),
    ('none','steam','2015240','key_giveaway','Unmapped Key Giveaway','https://www.gamerpower.com/x','https://www.gamerpower.com/x')`);
  const urls: string[] = [];
  await refreshSteamMetadata(db, async url => { urls.push(String(url)); return json(String(url).includes("2015240") ? dwarven : steam); }, 90000000);
  expect(urls.sort()).toEqual(["https://store.steampowered.com/api/appdetails?appids=123&cc=id&l=en", "https://store.steampowered.com/api/appdetails?appids=2015240&cc=id&l=en"]);
  const dw = await readMetadata(db, "dw");
  expect(dw).toMatchObject({ canonicalSteamAppId: 2015240, developer: "Crater Studios", publisher: "Crater Studios", platforms: ["windows"], aboutText: "Face massive hordes." });
  expect(dw?.fieldSources?.developer).toEqual({ provider: "steam", sourceUrl: "https://store.steampowered.com/api/appdetails?appids=2015240&cc=id&l=en", productId: "2015240", locale: "en", country: "ID", fetchedAt: 90000000 });
  expect(dw?.fieldSources?.screenshots).toBeUndefined();
  expect((await readMetadata(db, "link"))?.canonicalSteamAppId).toBe(123);
  expect(await readMetadata(db, "fake")).toBeNull();
  expect(await readMetadata(db, "none")).toBeNull();
  db.close();
});
it("mapped identity mismatch from Steam cannot enrich and legacy payloads still decode", async () => {
  const db = await testDb();
  await db.execute("INSERT INTO games(id,store,external_id,kind,title,store_url,claim_url) VALUES('dw','steam','3716','key_giveaway','Dwarven Realms (Steam) Key Giveaway','https://www.gamerpower.com/d','https://www.gamerpower.com/d')");
  await refreshSteamMetadata(db, async () => json({ "2015240": { success: true, data: { ...dwarven["2015240"].data, name: "Something Else" } } }), 90000000);
  expect(await readMetadata(db, "dw")).toBeNull();
  const legacy = { ...parseSteamMetadata(steam, 123, 1) };
  delete (legacy as Record<string, unknown>).fieldSources;
  delete (legacy as Record<string, unknown>).canonicalSteamAppId;
  expect(decodeMetadata(JSON.stringify(legacy))?.aboutText).toBe("Hello & world\n\nNext");
  expect(decodeMetadata(JSON.stringify({ ...legacy, canonicalSteamAppId: 999 }))).toBeNull();
  expect(decodeMetadata(JSON.stringify({ ...legacy, fieldSources: { developer: { provider: "steam", sourceUrl: "https://evil.test/", productId: "123", locale: "en", country: "ID", fetchedAt: 1 } } }))).toBeNull();
  db.close();
});

const hls = "https://video.akamai.steamstatic.com/store_trailers/2015240/762264/ddabdcc5babecd239613a67c7a46e6e2199d19e3/1751067658/hls_264_master.m3u8?t=1727386629";
const poster = "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/257059207/97a2adb2e79de12e138c2206396fc718364f8785/movie_600x337.jpg?t=1727386629";
const movie = { id: 257059207, name: "Dwarven Realms Gameplay Trailer Launch", thumbnail: poster, dash_h264: hls.replace("hls_264_master.m3u8", "dash_h264.mpd"), hls_h264: hls, highlight: true };
const withMovies = (movies: unknown) => ({ "2015240": { success: true, data: { ...dwarven["2015240"].data, movies } } });
it("stores only a guarded official Steam HLS trailer; hostile or DASH-only movies yield none", () => {
  expect(parseSteamMetadata(withMovies([movie]), 2015240, 1).trailer).toEqual({ kind: "native", url: hls, mimeType: "application/vnd.apple.mpegurl", poster, title: "Dwarven Realms Gameplay Trailer Launch" });
  expect(parseSteamMetadata(withMovies([movie]), 2015240, 1).fieldSources?.trailer?.productId).toBe("2015240");
  for (const url of [hls.replace("video.akamai", "video.akamai.steamstatic.com.evil"), hls.replace("https:", "http:"), hls.replace("/2015240/", "/440/"), hls.replace(".com/", ".com:8443/"), hls.replace("https://", "https://u:p@"), hls.replace("hls_264_master.m3u8", "dash_h264.mpd"), "com.epicgames.video://db158029"])
    expect(parseSteamMetadata(withMovies([{ ...movie, hls_h264: url }]), 2015240, 1).trailer).toBeNull();
  expect(parseSteamMetadata(withMovies([{ ...movie, hls_h264: undefined }]), 2015240, 1).trailer).toBeNull();
  expect(parseSteamMetadata(withMovies([{ ...movie, thumbnail: "https://evil.test/x.jpg" }]), 2015240, 1).trailer).toBeNull();
  expect(parseSteamMetadata(withMovies("junk"), 2015240, 1).trailer).toBeNull();
  const ok = parseSteamMetadata(withMovies([movie]), 2015240, 1);
  expect(decodeMetadata(JSON.stringify(ok))?.trailer?.url).toBe(hls);
  expect(decodeMetadata(JSON.stringify({ ...ok, trailer: { ...ok.trailer, url: hls.replace("/2015240/", "/1/") } }))).toMatchObject({ trailer: null, aboutText: ok.aboutText });
  expect(decodeMetadata(JSON.stringify({ ...ok, sourceUrl: "https://evil.test/", trailer: { ...ok.trailer, url: "bad" } }))).toBeNull();
  const legacy = { ...ok } as Record<string, unknown>;
  delete legacy.trailer;
  expect(decodeMetadata(JSON.stringify(legacy))?.trailer).toBeUndefined();
});
