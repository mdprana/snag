import { describe, it, expect } from "vitest";
import { PushSubscriptionInput, ClaimInput, NotifPrefsInput } from "@/src/lib/schemas";

const p256dh = Buffer.concat([Buffer.from([4]), Buffer.alloc(64, 7)]).toString("base64url");
const auth = Buffer.alloc(16, 9).toString("base64url");
const sub = (endpoint: string, keys = { p256dh, auth }) => ({ endpoint, keys });

describe("C10 push subscription input", () => {
  it.each([
    "https://web.push.apple.com/QGx",
    "https://api.push.apple.com/x",
    "https://fcm.googleapis.com/fcm/send/abc",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
  ])("accepts %s", (e) => expect(PushSubscriptionInput.safeParse(sub(e)).success).toBe(true));

  it.each([
    "https://169.254.169.254/x",
    "https://fcm.googleapis.com.evil.com/x",
    "http://web.push.apple.com/x",
    "https://push.apple.com.evil.com/x",
    "https://evilpush.apple.com/x",
    "https://web.push.apple.com:8443/x",
    "https://u:p@web.push.apple.com/x",
    "https://localhost/x",
    "not a url",
  ])("rejects %s", (e) => expect(PushSubscriptionInput.safeParse(sub(e)).success).toBe(false));

  it("rejects wrong key lengths", () => {
    const e = "https://web.push.apple.com/x";
    expect(PushSubscriptionInput.safeParse(sub(e, { p256dh: Buffer.alloc(64, 4).toString("base64url"), auth })).success).toBe(false);
    expect(PushSubscriptionInput.safeParse(sub(e, { p256dh, auth: Buffer.alloc(15).toString("base64url") })).success).toBe(false);
    expect(PushSubscriptionInput.safeParse(sub(e, { p256dh: p256dh.slice(0, -1) + "*", auth })).success).toBe(false);
  });

  it("rejects oversized endpoint", () => {
    expect(PushSubscriptionInput.safeParse(sub("https://web.push.apple.com/" + "a".repeat(2048))).success).toBe(false);
  });
});

describe("other inputs", () => {
  it("ClaimInput needs short gameId string", () => {
    expect(ClaimInput.safeParse({ gameId: "epic:abc" }).success).toBe(true);
    expect(ClaimInput.safeParse({ gameId: "" }).success).toBe(false);
    expect(ClaimInput.safeParse({ gameId: 1 }).success).toBe(false);
    expect(ClaimInput.safeParse({ gameId: "x", userId: "u" }).success).toBe(false);
  });
  it("NotifPrefsInput takes store booleans", () => {
    expect(NotifPrefsInput.safeParse({ epic: true, steam: false }).success).toBe(true);
    expect(NotifPrefsInput.safeParse({ epic: "yes", steam: false }).success).toBe(false);
  });
});
