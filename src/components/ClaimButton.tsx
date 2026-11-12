"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FeedGame } from "@/src/lib/games";
import { safeOutboundUrl, steamDeepLink } from "@/src/lib/urls";

export function ClaimButton({ game, signedIn = false }: { game: FeedGame; signedIn?: boolean }): React.ReactElement | null {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (game.upcoming) return null;
  const active = !game.endsAt || game.endsAt > new Date().getTime();
  const storeUrl = safeOutboundUrl(game.storeUrl);
  const href = game.store === "steam" && game.kind === "free_to_keep" && /^\d+$/.test(game.externalId)
    ? steamDeepLink(Number(game.externalId)) : safeOutboundUrl(game.claimUrl);
  async function toggle() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/claims", { method: game.claimed ? "DELETE" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: game.id }) });
      if (!response.ok) throw new Error("Could not save claim. Try again.");
      router.refresh();
    } catch { setError("Could not save claim. Try again."); }
    finally { setPending(false); }
  }
  return <div className="claim-actions">
    {!game.claimed && active && href && <a href={href} target="_blank" rel="noreferrer" aria-label={game.kind === "key_giveaway" ? "Get key on GamerPower" : undefined} className="claim-action btn btn-signal">{game.kind === "key_giveaway" ? "Get key" : "Claim"}</a>}
    {!game.claimed && storeUrl && game.store === "steam" && game.kind === "free_to_keep" && <a href={storeUrl} className="text-link text-sm">Open Steam website</a>}
    {signedIn ? <button type="button" disabled={pending} aria-pressed={game.claimed} className="btn btn-ghost disabled:opacity-50" onClick={toggle}>{game.claimed ? "Claimed · Undo" : "Mark claimed"}</button> : <a href="/login" className="text-link text-sm">Sign in to mark claimed</a>}
    {error && <p role="alert" className="text-sm">{error}</p>}
  </div>;
}
