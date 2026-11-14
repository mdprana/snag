import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/src/lib/db";
import { getSession } from "@/src/lib/session";
import { requireOwner } from "@/src/lib/auth";
import { hit } from "@/src/lib/ratelimit";
import { AsfReport } from "@/src/lib/asf";

export const metadata = { title: "Owner status | Snag" };

export default async function AdminPage() {
  const client = db();
  const session = await getSession(client, (await headers()).get("cookie"));
  if (!session) notFound();
  try { await requireOwner(client, session.userId); } catch (error) {
    if (error instanceof Response && error.status === 404) notFound();
    throw error;
  }
  const rate = await hit(client, `admin:view:${session.userId}`, 30, 60);
  if (!rate.ok) return <main id="main" className="mx-auto max-w-3xl p-8"><h1 className="text-3xl font-semibold">Owner status</h1><p className="mt-4">Too many requests. Wait {rate.retryAfter} seconds before refreshing.</p></main>;
  let data;
  try {
    const latest = (await client.execute("SELECT received_at,payload,(unixepoch('now') * 1000 - received_at > 900000) AS stale FROM asf_reports ORDER BY id DESC LIMIT 1")).rows[0];
    const report = latest ? AsfReport.parse(JSON.parse(String(latest.payload))) : null;
    const polls = (await client.execute("SELECT source,ok,count,at FROM poll_runs WHERE id IN (SELECT MAX(id) FROM poll_runs GROUP BY source) ORDER BY source LIMIT 3")).rows;
    data = { latest, report, polls };
  } catch {
    return <main id="main" className="mx-auto max-w-3xl p-8"><h1 className="text-3xl font-semibold">Owner status</h1><p className="mt-4" role="alert">Status could not be loaded. Refresh to retry.</p></main>;
  }
  return <main id="main" className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-8">
    <h1 className="text-3xl font-semibold">Owner status</h1>
    <section aria-labelledby="asf-title"><h2 id="asf-title" className="text-xl font-semibold">ArchiSteamFarm</h2>
      {data.report && data.latest ? <><p className="mt-4">Bot at last report: {data.report.online ? "Online" : "Offline"}</p><p>Received: {new Date(Number(data.latest.received_at)).toISOString()}</p>{Boolean(data.latest.stale) && <p>Report is stale. Check the local reporter timer.</p>}</> : <p className="mt-4">No report received. Configure the local reporter to send status.</p>}
      <p className="mt-4">Addlicense history unavailable. ASF does not expose a verified durable history of those results. Online status does not prove a successful claim.</p>
    </section>
    <section aria-labelledby="poll-title"><h2 id="poll-title" className="text-xl font-semibold">Latest offer polls</h2>
      {data.polls.length ? <ul className="mt-4 flex flex-col gap-3">{data.polls.map((poll) => <li key={String(poll.source)}><strong>{String(poll.source)}</strong>: {poll.ok ? "Succeeded" : "Failed"}, {Number(poll.count)} offers. {new Date(Number(poll.at)).toISOString()}</li>)}</ul> : <p className="mt-4">No poll recorded. Check the offer scheduler.</p>}
    </section>
    <Link href="/feed" className="underline">Back to feed</Link>
  </main>;
}
