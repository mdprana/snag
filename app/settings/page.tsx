import Link from "next/link";

export default function SettingsPage() {
  return <main className="mx-auto flex w-full max-w-md flex-col gap-8 p-8"><h1 className="text-3xl font-semibold">Settings</h1><section><h2 className="text-xl font-semibold">Account</h2><form action="/api/auth/logout" method="post"><button className="mt-4 rounded border px-4 py-3" type="submit">Sign out</button></form></section><section><h2 className="text-xl font-semibold">Delete account</h2><p className="mt-2">This removes claims, sessions, subscriptions, and account data.</p><form action="/api/account/delete" method="post" className="mt-4 flex gap-2"><input name="confirm" required placeholder="DELETE" aria-label="Type DELETE" className="min-w-0 flex-1 rounded border bg-transparent px-3" /><button className="rounded bg-red-700 px-4 py-3" type="submit">Delete</button></form></section><Link href="/feed" className="underline">Back to feed</Link></main>;
}
