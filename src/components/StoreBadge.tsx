export function StoreBadge({ store }: { store: string }): React.ReactElement {
  return <span className="badge">{store === "epic" ? "Epic" : "Steam"}</span>;
}
