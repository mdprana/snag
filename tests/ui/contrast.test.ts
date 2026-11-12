import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const css = readFileSync("app/globals.css", "utf8");
function luminance(hex: string) {
  const rgb = hex.match(/\w\w/g)!.map((value) => parseInt(value, 16) / 255).map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
it("every ink/bg token pair >= 4.5", () => {
  const tokens = Object.fromEntries([...css.matchAll(/--color-([\w-]+):\s*(#[\da-f]{6})/gi)].map((match) => [match[1], match[2]]));
  for (const name of ["bg", "surface", "ink", "ink-dim", "signal", "signal-ink", "epic", "steam", "ok"]) expect(tokens[name], name).toBeDefined();
  const pairs = ["ink", "ink-dim", "epic", "steam", "ok", "signal"].flatMap((ink) => ["bg", "surface"].map((bg) => [ink, bg]));
  pairs.push(["signal-ink", "signal"]);
  for (const [ink, bg] of pairs) {
    const values = [luminance(tokens[ink]), luminance(tokens[bg])].sort((a, b) => b - a);
    expect((values[0] + 0.05) / (values[1] + 0.05), `${ink}/${bg}`).toBeGreaterThanOrEqual(4.5);
  }
});
