import * as webpush from "web-push";
import type { Client } from "@libsql/client";
import { env } from "./env.ts";

export type PushPayload = { title: string; body: string; url: string };
export type PushSub = { id: string; endpoint: string; p256dh: string; auth: string };

webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

export async function sendToSub(db: Client, sub: PushSub, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload));
    return "ok";
  } catch (error: unknown) {
    const status = typeof error === "object" && error !== null && "statusCode" in error ? Number(error.statusCode) : 0;
    if (status === 404 || status === 410) {
      await db.execute({ sql: "DELETE FROM push_subs WHERE id = ?", args: [sub.id] });
      return "gone";
    }
    return "error";
  }
}

export function notificationText(game: { store: string; title: string; endsAt: number | null }, timeZone: string): { title: string; body: string } {
  const store = game.store === "epic" ? "Epic" : "Steam";
  const date = game.endsAt === null ? "further notice" : new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone }).format(new Date(game.endsAt));
  return { title: `Free on ${store}: ${game.title}`, body: `Yours to keep until ${date}. Tap to claim.` };
}
