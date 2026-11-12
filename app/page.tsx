import { connection } from "next/server";
import { db } from "@/src/lib/db";
import { listFeed } from "@/src/lib/games";
import { safeImageUrl } from "@/src/lib/urls";
import { Logo } from "@/src/components/Logo";
import { StoreBadge } from "@/src/components/StoreBadge";
import { FreeCount } from "@/src/components/FreeCount";

export default async function Home() {
  await connection();
  const { freeNow } = await listFeed(db(), undefined, new Date());
  return <main className="landing mx-auto w-full max-w-[1200px] px-5 py-8 sm:px-10">
    <header className="mb-16 flex items-center justify-between gap-4"><Logo /><a className="landing-link" href="/login">Sign in</a></header>
    <section aria-labelledby="available-title">
      <p className="landing-meta">Good games. Zero price tag.</p>
      <h1 id="available-title" className="my-8"><FreeCount count={freeNow.length} /><span className="block mt-4 text-3xl font-semibold uppercase sm:text-5xl">free to keep right now</span></h1>
      <p className="max-w-xl text-lg text-[#a39b90]">Epic and Steam giveaways. One place to find them. One tap to the store. Yours to claim before time runs out.</p>
      <div className="my-8 flex flex-wrap gap-4"><a className="landing-cta" href="/feed">Browse free games</a><a className="landing-link" href="/login">Sign in with Steam</a></div>
      <p className="landing-meta">Last known offers · checked every 30 minutes · availability varies by region</p>
      <div className="landing-strip mt-6" aria-label="Current free games">{freeNow.map((game) => <a key={game.id} href={`/g/${encodeURIComponent(game.id)}`} className="landing-game" aria-label={game.title}>{safeImageUrl(game.imageUrl) ? <img src={safeImageUrl(game.imageUrl)!} alt={game.title} className="aspect-video w-full rounded-lg object-cover" /> : <div aria-hidden="true" className="landing-placeholder aspect-video rounded-lg">FREE TO KEEP</div>}<div className="mt-3 flex items-start justify-between gap-3"><h2 className="text-xl font-semibold">{game.title}</h2><StoreBadge store={game.store} /></div></a>)}{!freeNow.length && <p className="py-8 text-[#a39b90]">Nothing free right now. We check every 30 minutes.</p>}</div>
    </section>
    <section className="landing-how my-16 border-t border-[#2a2622] pt-10" aria-labelledby="how-title"><div><h2 id="how-title" className="mb-8 text-3xl font-semibold uppercase">Less checking.<br />More playing.</h2><ol className="space-y-7">{[["Sign in with Steam", "Your public identity, never your password. Epic sign-in is optional and disabled by default."], ["Add to Home Screen", "On iPhone, open Safari, tap Share, then Add to Home Screen. Enable notifications in settings."], ["Tap the push", "Open the offer, claim at the store, then mark it claimed. Snag does not claim games for you."]].map(([title, body], index) => <li key={title} className="flex gap-5"><span className="landing-meta pt-1">0{index + 1}</span><div><h3 className="text-xl font-semibold">{title}</h3><p className="mt-2 max-w-md text-[#a39b90]">{body}</p></div></li>)}</ol></div><aside className="landing-notification" aria-label="Example notification"><p className="landing-meta">Preview · not a live notification</p><p className="mt-8 font-bold tracking-widest">SNAG</p><h3 className="mt-5 text-2xl font-semibold">Free on Epic: Your next game</h3><p className="mt-3 text-[#a39b90]">Yours to keep until Friday. Tap to claim.</p><a className="landing-link mt-8" href="/settings/notifications">Set up notifications</a></aside></section>
    <footer className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#2a2622] pt-6 text-[#a39b90]"><a className="landing-link" href="/privacy">Privacy</a><a className="landing-link" href="/self-host">Self-host</a><p className="text-sm">Not affiliated with Valve or Epic Games.</p></footer>
  </main>;
}
