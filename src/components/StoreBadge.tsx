function SteamMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12.3 3.5a5.2 5.2 0 0 0-4.9 3.4l3.1 1.3a2.2 2.2 0 1 1-.8 4.2l-3.2-1.3A5.2 5.2 0 1 0 12.3 3.5Zm0 2a3.2 3.2 0 1 1 0 6.4 3.2 3.2 0 0 1 0-6.4ZM4.7 9.6l2.8 1.2a4.2 4.2 0 1 0 1.4 5.8l-2.7-1.1a2.4 2.4 0 1 1-1.5-4.5Z" /></svg>;
}

function EpicMark() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M4 3h16v18H4V3Zm3 3v12h10v-2H9v-3h7v-2H9V8h8V6H7Z" /></svg>;
}

export function StoreBadge({ store }: { store: string }): React.ReactElement {
  const epic = store === "epic";
  return <span className={`badge store-badge store-${epic ? "epic" : "steam"}`} title={`${epic ? "Epic" : "Steam"} store`}><span className="store-mark">{epic ? <EpicMark /> : <SteamMark />}</span>{epic ? "Epic" : "Steam"}</span>;
}
