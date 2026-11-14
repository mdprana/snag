import { z } from "zod";

export const AsfClaim = z.strictObject({
  at: z.iso.datetime(),
  kind: z.enum(["sub", "app"]),
  id: z.number().int().min(1).max(4294967295),
  result: z.string().regex(/^[A-Za-z]{1,40}\/[A-Za-z]{1,40}$/),
});

export const AsfReport = z.strictObject({
  online: z.boolean(),
  history: z.union([z.literal("unavailable"), z.array(AsfClaim).max(20)]),
});
