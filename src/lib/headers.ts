// Spec C6 image hosts; Steam CDN hosts unverified until T6.
const IMAGE_HOSTS = [
  "https://cdn1.epicgames.com",
  "https://cdn2.unrealengine.com",
  "https://shared.fastly.steamstatic.com",
  "https://shared.akamai.steamstatic.com",
  "https://cdn.akamai.steamstatic.com",
  "https://www.gamerpower.com",
];

export function buildCsp(nonce: string, dev: boolean): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: ${IMAGE_HOSTS.join(" ")}`,
    "connect-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self' https://steamcommunity.com https://www.epicgames.com",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function securityHeaders(): Record<string, string> {
  return {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
  };
}
