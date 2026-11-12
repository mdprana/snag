import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const randomToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb) && a === b;
}
