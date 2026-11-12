const OUTBOUND_HOSTS = new Set(["store.epicgames.com", "store.steampowered.com", "www.gamerpower.com", "gamerpower.com"]);
const IMAGE_HOSTS = new Set([
  "cdn1.epicgames.com",
  "cdn2.unrealengine.com",
  "shared.fastly.steamstatic.com",
  "shared.akamai.steamstatic.com",
  "cdn.akamai.steamstatic.com",
  "www.gamerpower.com",
]);

function allow(u: string, hosts: Set<string>): string | null {
  if (!URL.canParse(u)) return null;
  const url = new URL(u);
  if (url.protocol !== "https:" || url.port || url.username || url.password || !hosts.has(url.hostname)) return null;
  return url.href;
}

export function safeOutboundUrl(u: string): string | null {
  const href = allow(u, OUTBOUND_HOSTS);
  return href && new URL(href).pathname.startsWith("/open/") ? null : href;
}

export function safeImageUrl(u: string): string | null {
  return allow(u, IMAGE_HOSTS);
}

export function steamDeepLink(appid: number): string {
  if (!Number.isSafeInteger(appid) || appid <= 0) throw new Error("invalid steam appid");
  return `steam://store/${appid}`;
}
