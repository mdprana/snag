export function StoreBadge({ store }: { store: string }): React.ReactElement {
  return <span className="border border-white/30 px-1.5 py-0.5 uppercase">{store === "epic" ? "Epic" : "Steam"}</span>;
}
