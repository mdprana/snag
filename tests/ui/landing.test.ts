import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GameArt } from "@/src/components/GameArt";
import { Logo } from "@/src/components/Logo";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { formatUtc } from "@/src/components/Countdown";
import { lastPoll, soonestEnding, type FeedGame } from "@/src/lib/games";

const base: FeedGame = { id: "a", store: "epic", externalId: "a", kind: "free_to_keep", title: "A", storeUrl: "", claimUrl: "", imageUrl: "", startsAt: 0, endsAt: null, upcoming: false, claimed: false };

describe("landing data", () => {
  it("optimized artwork and logo omit CSP-blocked inline styles", () => {
    for (const element of [GameArt({ imageUrl: "https://cdn1.epicgames.com/cover.jpg", title: "Cover", store: "epic" }), Logo()]) {
      const html = renderToStaticMarkup(element);
      expect(html).toContain("<img");
      expect(html).not.toContain("style=");
    }
    expect(renderToStaticMarkup(GameArt({ imageUrl: "https://cdn1.epicgames.com/cover.jpg", title: "Cover", store: "epic" }))).toContain("srcSet=");
  });
  it("soonestEnding picks the earliest end and skips open-ended offers", () => {
    expect(soonestEnding([])).toBeNull();
    expect(soonestEnding([base])).toBeNull();
    const games = [{ ...base, id: "late", endsAt: 300 }, base, { ...base, id: "soon", endsAt: 200 }];
    expect(soonestEnding(games)?.id).toBe("soon");
  });
  it("formatUtc renders a short absolute UTC time", () => {
    expect(formatUtc(Date.UTC(2026, 10, 19, 16, 0))).toBe("Nov 19, 2026, 4:00 PM UTC");
  });
  it("lastPoll returns the latest successful run or null", async () => {
    const db = createClient({ url: "file::memory:" });
    await db.executeMultiple(readFileSync("db/migrations/001_init.sql", "utf8") + readFileSync("db/migrations/002_poll_runs.sql", "utf8"));
    expect(await lastPoll(db)).toBeNull();
    await db.execute("INSERT INTO poll_runs(source, ok, at) VALUES('epic', 1, 100), ('epic', 0, 300), ('steam', 1, 200)");
    expect(await lastPoll(db)).toBe(200);
  });
});
