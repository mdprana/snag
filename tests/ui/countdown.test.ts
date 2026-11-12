import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Countdown, formatCountdown } from "@/src/components/Countdown";

describe("Countdown", () => {
  it("formats 2d 4h, aria-label absolute date", () => {
    const now = Date.UTC(2026, 10, 12);
    const endsAt = now + 2 * 86400000 + 4 * 3600000;
    expect(formatCountdown(endsAt - now)).toBe("2d 4h");
    expect(renderToStaticMarkup(createElement(Countdown, { endsAt, now }))).toContain('aria-label="Ends November 14, 2026 at 4:00 AM UTC"');
  });
  it("handles ended and less than one hour", () => {
    expect(formatCountdown(0)).toBe("ended");
    expect(formatCountdown(60000)).toBe("<1h");
  });
});
