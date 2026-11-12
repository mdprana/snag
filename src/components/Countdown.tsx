export function formatCountdown(milliseconds: number): string {
  if (milliseconds <= 0) return "ended";
  if (milliseconds < 3600000) return "<1h";
  const hours = Math.floor(milliseconds / 3600000);
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return days ? `${days}d ${remainingHours}h` : `${remainingHours}h`;
}

export function formatUtc(at: number): string {
  return `${new Date(at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC`;
}

export function Countdown({ endsAt, now }: { endsAt: number; now: number }): React.ReactElement {
  const remaining = endsAt - now;
  const absolute = new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short", timeZone: "UTC" }).format(endsAt);
  return <span className="countdown" aria-label={`Ends ${absolute} UTC`}>{formatCountdown(remaining)}</span>;
}

export function UtcTime({ at }: { at: number }): React.ReactElement {
  return <time dateTime={new Date(at).toISOString()}>{formatUtc(at)}</time>;
}
