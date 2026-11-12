import type { ReactNode } from "react";

export function Entry({ children }: { children: ReactNode }): React.ReactElement {
  return <div className="entry-motion">{children}</div>;
}
