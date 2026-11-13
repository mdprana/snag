import type { ReactNode } from "react";

export function DetailValue({ value }: { value: ReactNode }) {
  return value ? <>{value}</> : <span className="dim">Not listed by Steam, Epic or Wikidata</span>;
}
