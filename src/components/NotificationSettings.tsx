"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InstallGuide } from "./InstallGuide";

type Device = { id: string; stores: string; createdAt: number };
export function NotificationSettings({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const [state, setState] = useState<"loading" | "install" | "unsupported" | NotificationPermission>("loading");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const installed = window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
      setState(!installed ? "install" : !("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) ? "unsupported" : Notification.permission);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); router.refresh(); } catch { setMessage("Could not save notification settings. Try again."); }
    finally { setBusy(false); }
  }
  async function enable() {
    const permission = await Notification.requestPermission();
    setState(permission);
    if (permission !== "granted") return;
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) throw new Error("Push unavailable");
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const bytes = Uint8Array.from(atob(key.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - key.length % 4) % 4)), (char) => char.charCodeAt(0));
    const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
    const response = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
    if (!response.ok) throw new Error("Subscribe failed");
    setMessage("Notifications enabled on this device.");
  }
  async function update(device: Device, store: string, checked: boolean) {
    const stores = new Set(device.stores.split(","));
    if (checked) stores.add(store); else stores.delete(store);
    const response = await fetch(`/api/push/${encodeURIComponent(device.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ epic: stores.has("epic"), steam: stores.has("steam") }) });
    if (!response.ok) throw new Error("Update failed");
  }
  return <div className="space-y-6">
    {state === "loading" && <p>Checking device…</p>}
    {state === "install" && <InstallGuide />}
    {state === "unsupported" && <p>Push notifications are not supported on this device.</p>}
    {state === "denied" && <p>Notifications blocked. Open iPhone Settings, Snag, Notifications, then allow notifications. On other devices, allow notifications in browser site settings.</p>}
    {(state === "default" || state === "granted") && <button disabled={busy} onClick={() => run(enable)} className="min-h-11 bg-orange-400 px-5 py-3 font-semibold text-black">{state === "granted" ? "Enable on this device" : "Enable notifications"}</button>}
    {state === "granted" && <button disabled={busy || !devices.length} className="min-h-11 border px-5 py-3" onClick={() => run(async () => { const response = await fetch("/api/push/test", { method: "POST" }); if (!response.ok) throw new Error("Test failed"); const data = await response.json(); setMessage(data.results?.includes("ok") ? "Test notification sent." : "No notification delivered. Enable this device again."); })}>Send test</button>}
    <section className="space-y-3"><h2 className="text-xl font-semibold">Devices</h2>{!devices.length && <p>No devices enabled.</p>}{devices.map((device, index) => <div key={device.id} className="space-y-2 border-b border-white/20 py-3"><h3>Device {index + 1}</h3><p className="text-sm">Added {new Date(device.createdAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</p>{["epic", "steam"].map((store) => <label key={store} className="flex min-h-11 items-center justify-between capitalize">{store}<input type="checkbox" className="size-6" checked={device.stores.split(",").includes(store)} disabled={busy} onChange={(event) => run(() => update(device, store, event.target.checked))} /></label>)}<button disabled={busy} className="min-h-11 underline" onClick={() => run(async () => { const response = await fetch(`/api/push/${encodeURIComponent(device.id)}`, { method: "DELETE" }); if (!response.ok) throw new Error("Remove failed"); })}>Remove device {index + 1}</button></div>)}</section>
    <p role="status">{message}</p>
  </div>;
}
