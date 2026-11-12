"use client";

export default function ErrorPage({ retry }: { retry: () => void }) {
  return <main id="main" className="shell py-8"><h1 className="page-title">Offers could not load</h1><p role="alert" className="dim my-6">The saved feed is unavailable. Try loading it again.</p><button className="btn btn-ink" onClick={retry}>Retry offers</button></main>;
}
