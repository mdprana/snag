import { Logo } from "./Logo";

export function SiteHeader({ signedIn }: { signedIn: boolean }): React.ReactElement {
  return <header className="site-header shell">
    <Logo />
    <nav aria-label="Main"><ul className="nav-list"><li><a className="nav-link" href="/feed">Feed</a></li><li>{signedIn ? <a className="nav-link" href="/settings">Settings</a> : <a className="nav-link" href="/login">Sign in</a>}</li></ul></nav>
  </header>;
}
