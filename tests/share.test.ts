import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { getGame, readMetadataRecord, readMetadata } = vi.hoisted(() => ({ getGame: vi.fn(), readMetadataRecord: vi.fn(), readMetadata: vi.fn() }));
vi.mock("@/src/lib/db", () => ({ db: () => ({}) }));
vi.mock("@/src/lib/games", () => ({ getGame }));
vi.mock("@/src/lib/metadata", () => ({ readMetadataRecord, readMetadata }));
vi.mock("next/og", () => ({ ImageResponse: class { constructor(public element: unknown) {} } }));

afterEach(() => vi.useRealTimers());

vi.mock("next/font/google", () => ({ Saira: () => ({ variable: "saira" }), Atkinson_Hyperlegible: () => ({ variable: "atkinson" }) }));

it("sets absolute share image base and large Twitter card metadata", async () => {
  const { metadata } = await import("@/app/layout");
  expect(metadata.metadataBase).toBeInstanceOf(URL);
  const base = new URL(String(metadata.metadataBase));
  const image = new URL("/opengraph-image", base);
  expect(image.href).toBe(`${base.origin}/opengraph-image`);
  expect(metadata.openGraph).toMatchObject({ type: "website", siteName: "Snag", locale: "en_US", title: "Snag: free games on Epic and Steam" });
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image" });
  expect(metadata.title).toEqual({ template: "%s | Snag", default: "Snag: free games on Epic and Steam" });
});

it.each([
  ["free_to_keep", -1000, 1000, "Free to keep"],
  ["key_giveaway", -1000, 1000, "Key giveaway"],
  ["free_to_keep", 1000, 2000, "Coming soon"],
  ["key_giveaway", 1000, 2000, "Coming soon"],
  ["free_to_keep", -2000, 0, "Offer ended"],
  ["key_giveaway", -2000, 0, "Offer ended"],
  ["free_to_keep", -1000, null, "Availability unconfirmed"],
])("shares factual %s offer status %s/%s", async (kind, start, end, status) => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-14T12:00:00Z"));
  const now = Date.now();
  getGame.mockResolvedValue({ id: "fixture", title: "Fixture", store: "steam", kind, startsAt: now + start, endsAt: end === null ? null : now + end, imageUrl: "", upcoming: false });
  readMetadataRecord.mockResolvedValue({ metadata: { aboutText: "Fixture summary." } });
  readMetadata.mockResolvedValue(null);
  const { generateMetadata } = await import("@/app/g/[id]/page");
  const props = { params: Promise.resolve({ id: "fixture" }) };
  const metadata = await generateMetadata(props);
  expect(metadata.title).toBe(`Fixture: ${status} on Steam`);
  expect(metadata.description).toBe(`Fixture: ${status} on Steam. Fixture summary.`);
  expect(metadata.openGraph).toMatchObject({ title: metadata.title, description: metadata.description });
  readMetadataRecord.mockResolvedValue({ metadata: null });
  expect((await generateMetadata(props)).description).toBe(`Fixture: ${status} on Steam.`);
  const { default: Image } = await import("@/app/g/[id]/opengraph-image");
  const image = await Image(props);
  const rendered = JSON.stringify(image);
  expect(rendered).toContain(status);
  if (status !== "Free to keep") expect(rendered).not.toContain("Free to keep");
  if (status === "Offer ended") expect(rendered).not.toContain('"Ends ');
});

it.each(["/opengraph-image", "/twitter-image/", "/g/fixture/opengraph-image", "/g/fixture/twitter-image/"])("exempts only exact image route %s", async path => {
  const { proxy } = await import("@/proxy");
  expect((await proxy(new NextRequest(`https://localhost:3100${path}`))).headers.has("Content-Security-Policy")).toBe(false);
});

it.each(["/", "/feed", "/g/fixture", "/opengraph-image-extra", "/twitter-image/nested", "/g/fixture/opengraph-image/extra", "/prefix/g/fixture/twitter-image", "/g/fixture/twitter-image-extra"])("preserves page CSP for %s", async path => {
  const { proxy } = await import("@/proxy");
  expect((await proxy(new NextRequest(`https://localhost:3100${path}`))).headers.get("Content-Security-Policy")).toContain("script-src");
});
