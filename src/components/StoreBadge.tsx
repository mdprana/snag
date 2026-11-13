import { IconLabel } from "./IconLabel";

export function StoreBadge({ store }: { store: string }): React.ReactElement {
  return <IconLabel kind={store === "epic" ? "epic" : "steam"} />;
}

export function PlatformLabels({ platforms }: { platforms: string[] | null }): React.ReactElement | null {
  const known = [...new Set(platforms ?? [])];
  return known.length ? <ul aria-label="Platforms" className="platform-labels">{known.map(kind => <li key={kind}><IconLabel kind={kind} /></li>)}</ul> : null;
}
