import { IconLabel, type LabelKind } from "./IconLabel";

const platformKinds = new Set<string>(["windows", "macos", "linux", "android", "ios"]);

export function StoreBadge({ store }: { store: string }): React.ReactElement {
  return <IconLabel kind={store === "epic" ? "epic" : "steam"} />;
}

export function PlatformLabels({ platforms }: { platforms: string[] | null }): React.ReactElement | null {
  const known = (platforms ?? []).filter(platform => platformKinds.has(platform)) as LabelKind[];
  return known.length ? <ul aria-label="Platforms" className="platform-labels">{known.map(kind => <li key={kind}><IconLabel kind={kind} /></li>)}</ul> : null;
}
