import Link from "next/link";

export default function LoginPage() {
  return <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 p-8"><h1 className="text-3xl font-semibold">Sign in</h1><p>Save claims and manage notifications.</p><a className="rounded bg-white px-4 py-3 text-center text-black" href="/api/auth/steam">Continue with Steam</a><Link href="/" className="text-center underline">Back</Link></main>;
}
