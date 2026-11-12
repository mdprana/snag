import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/src/lib/db";
import { getSession } from "@/src/lib/session";
import { NotificationSettings } from "@/src/components/NotificationSettings";

export default async function NotificationsPage() {
  const session = await getSession(db(), (await cookies()).toString());
  if (!session) redirect("/login");
  const { rows } = await db().execute({ sql: "SELECT id, stores, created_at FROM push_subs WHERE user_id = ? ORDER BY created_at DESC", args: [session.userId] });
  const devices = rows.map((row) => ({ id: String(row.id), stores: String(row.stores), createdAt: Number(row.created_at) }));
  return <main className="mx-auto w-full max-w-md space-y-8 px-4 py-8"><header><p className="text-xs uppercase tracking-widest text-orange-300">Settings</p><h1 className="text-3xl font-semibold">Notifications</h1></header><NotificationSettings devices={devices} /><a href="/feed" className="block min-h-11 py-3 underline">Back to feed</a></main>;
}
