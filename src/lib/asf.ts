import { z } from "zod";

export const AsfReport = z.strictObject({
  online: z.boolean(),
  history: z.literal("unavailable"),
});
