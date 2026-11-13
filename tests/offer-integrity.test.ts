import { expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { ClaimButton } from "@/src/components/ClaimButton";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh() {} }) }));

it("future and unconfirmed offers never expose claim links", () => {
  const game = { id: "x", store: "steam", externalId: "123", kind: "free_to_keep", title: "X", storeUrl: "https://store.steampowered.com/app/123/", claimUrl: "", imageUrl: "", startsAt: Date.now() + 60000, endsAt: Date.now() + 120000, upcoming: false, claimed: false, platforms: null };
  expect(renderToStaticMarkup(createElement(ClaimButton, { game }))).not.toContain('claim-action btn');
  expect(renderToStaticMarkup(createElement(ClaimButton, { game: { ...game, startsAt: null, endsAt: null } }))).not.toContain('claim-action btn');
});
import { testDb } from "./helpers/db";
import { listFeed, lastPoll } from "@/src/lib/games";

it("null starts require fresh matching source confirmation; windows override stale upcoming flags", async () => {
  const db = await testDb();
  await db.executeMultiple(`INSERT INTO games(id,store,external_id,kind,title,starts_at,ends_at,upcoming) VALUES
    ('open','steam','123','free_to_keep','Open',NULL,NULL,0),
    ('ended','epic','ended','free_to_keep','Ended',1,90,1),
    ('started','epic','started','free_to_keep','Started',50,200,1),
    ('future','epic','future','free_to_keep','Future',150,200,0);
    INSERT INTO poll_runs(source,ok,at) VALUES('steam',1,99),('epic',1,99),('gamerpower',1,99);`);
  const feed = await listFeed(db, undefined, new Date(100));
  expect(feed.freeNow.map(g => g.id).sort()).toEqual(["open", "started"]);
  expect(feed.upcoming.map(g => g.id)).toEqual(["future"]);
  await db.execute("INSERT INTO poll_runs(source,ok,at) VALUES('steam',0,101)");
  expect((await listFeed(db, undefined, new Date(102))).freeNow.map(g => g.id)).toEqual(["started"]);
  expect((await listFeed(db, undefined, new Date(172800100))).freeNow).toEqual([]);
  db.close();
});

it("lastPoll is conservative across required sources, not healthy Epic masking failed Steam", async () => {
  const db = await testDb();
  await db.execute("INSERT INTO poll_runs(source,ok,at) VALUES('epic',1,300),('steam',1,100),('gamerpower',1,200),('steam',0,400)");
  expect(await lastPoll(db)).toBe(100);
  db.close();
});

it("active claim link names its destination and new-tab behaviour for assistive tech", () => {
  const game = { id: "e", store: "epic", externalId: "e", kind: "free_to_keep", title: "E", storeUrl: "https://store.epicgames.com/en-US/p/e", claimUrl: "https://store.epicgames.com/purchase?offers=e", imageUrl: "", startsAt: Date.now() - 1000, endsAt: Date.now() + 60000, upcoming: false, claimed: false, platforms: null };
  const html = renderToStaticMarkup(createElement(ClaimButton, { game }));
  expect(html).toContain('target="_blank"');
  expect(html).toContain('Claim<span class="sr-only"> on Epic Games Store (opens in a new tab)</span><svg aria-hidden="true"');
});
