<div align="center">

# Snag

### Good games. Zero price tag.

Free-game discovery for **Epic Games Store** and **Steam**.

![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)
![libSQL](https://img.shields.io/badge/Database-libSQL-4051b5)

[Overview](#overview) · [Development](#development) · [Configuration](#configuration) · [Checks](#checks)

</div>

---

> **In development.** Not deployed or ready for public accounts. Provider login and browser push are implemented but unverified live. Self-host examples are untested.

## Overview

Discover an offer, check its claim window, and open the store to keep it. Snag brings limited-time game giveaways into one place, using the last known offers stored in its database.

### Current implementation

- **Application shell** with Next.js App Router, React and Tailwind CSS.
- **Database migrations** for libSQL.
- **Session and request utilities** covering origin checks, rate limiting and input validation.
- **Security headers** with a nonce-based Content Security Policy.
- **Configuration validation** and sensitive-field redaction in logs.
- **Public landing page**, database-backed game feed and game detail pages, with claim links and per-account claim tracking.
- **Bounded store metadata**, About content and screenshot galleries, with honest fallbacks when store data is unavailable.
- **Artwork-led hero** and recognizable store/platform icons with accessible labels.
- **UTC dates** for consistent offer timing.
- **Offer polling** for Epic, Steam and GamerPower, with last-known data retained on source errors. An external scheduler must invoke the protected cron route; the app does not schedule itself.
- **Steam sign-in**, optional Epic sign-in, logout and account deletion. Provider login remains unverified live; Epic login is disabled by default.
- **PWA and notification settings** with installation guidance, device subscriptions, per-store preferences and test notifications. Browser push delivery remains unverified live, including iPhone Home Screen behavior.
- **Privacy and self-host pages**. Optional third-party claiming tools are separate from Snag; their examples have not been tested as a deployment.
- **Automated unit and browser tests** using local data and provider fixtures, not live account credentials.

### Not verified or deployed

Production hosting, live provider login, live push delivery and third-party self-host examples still need operator verification. Owner-only ASF integration is not connected. Snag never automatically claims games for public users.

## Development

Requires **Node.js 22.18+** and npm. Run commands from the project root.

```sh
npm ci
cp .env.example .env
```

Fill in the required values in `.env`. Keep `EPIC_LOGIN_ENABLED=false` while developing without Epic credentials.

Generate development VAPID keys:

```sh
node --input-type=module -e "import * as webpush from 'web-push'; console.log(webpush.generateVAPIDKeys())"
```

Copy `publicKey` into `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `privateKey` into `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to your contact URI, such as `mailto:you@example.com`.

Generate a separate cron secret and copy the output into `CRON_SECRET`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Initialize the database, then start development:

```sh
npm run db:migrate
npm run dev
```

Open **https://localhost:3100**. Development uses a local HTTPS certificate, so your browser may show a certificate warning. Only trust a certificate you generated locally.

These settings are required by the current validator even when push and cron are not being exercised. Never commit `.env`, credentials or database files.

## Configuration

Template: [`.env.example`](.env.example). Validator: [`src/lib/env.ts`](src/lib/env.ts).

| Variable | Purpose |
| --- | --- |
| `APP_URL` | Required HTTPS origin without a path or trailing slash. Local default: `https://localhost:3100`. |
| `DATABASE_URL` | Required database connection. Local default: `file:snag.db`. |
| `DATABASE_AUTH_TOKEN` | Optional remote database credential. |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Required public VAPID key, intended for browser use. |
| `VAPID_PRIVATE_KEY` | Required private VAPID key, server-side only. |
| `VAPID_SUBJECT` | Required `mailto:` or `https://` contact URI. |
| `CRON_SECRET` | Required random secret, at least 32 characters. |
| `ASF_REPORT_SECRET` | Optional reporting secret, at least 32 characters when set. |
| `OWNER_STEAMID64` | Optional owner identifier, exactly 17 digits. |
| `EPIC_LOGIN_ENABLED` | Keep `false` until the Epic integration is configured and tested. |
| `EPIC_CLIENT_ID` / `EPIC_CLIENT_SECRET` | Required when `EPIC_LOGIN_ENABLED=true`. Keep the secret server-side. |

Presence checks do not verify provider access or key validity. Configuring a variable does not make its associated feature ready.

## Checks

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Unit tests use fixtures and mocked provider responses; they do not verify live provider access or push delivery. Browser checks cover 26 cases across 320, 390, 768 and 1440 px widths, all using synthetic fixtures, not live integration. Browser tests run separately with `npx playwright test` and require Playwright Chromium. Their configuration creates a disposable fixture database and starts local HTTPS on port 3100.

Additional dependency and secret checks:

```sh
npm run check:audit
npm run check:secrets
```

The secret check requires `gitleaks`; without it, the command reports a skip. A skip is not a clean scan.

## Structure

```text
app/                    Pages, API routes, application layout and styles
src/components/         Feed, account and notification UI
src/lib/                Database, auth, polling, push and security utilities
db/migrations/          Versioned SQL migrations
scripts/migrate.ts      Migration runner
tests/                  Unit tests and provider-response fixtures
e2e/                    Local Playwright browser tests
proxy.ts                Content Security Policy and security headers
```

## Deployment and self-hosting

Public hosting is not configured. Before accepting public accounts, verify provider callbacks and push delivery, configure HTTPS and a scheduler, and identify the operator, processors, privacy contact and backup-retention policy. Account deletion in Settings requires typing `DELETE`; it removes account-linked records from the active database, not operator backups or store accounts.

### Optional claiming tools — untested examples

The `/self-host` page contains fuller setup and safety notes. These third-party tools require your own credentials on your own **always-on machine** (home PC, compatible Raspberry Pi or VPS). Check image CPU support and allow about 2 GB RAM plus OS headroom for Epic’s browser. They do not connect to Snag or report claims to it.

The following Compose example has **not been deployment-tested**. Review upstream instructions for [ArchiSteamFarm](https://github.com/JustArchiNET/ArchiSteamFarm/wiki/Docker), [Citrinate/FreePackages](https://github.com/Citrinate/FreePackages) and [epicgames-freegames-node](https://github.com/claabs/epicgames-freegames-node). Pin reviewed image digests before unattended use and verify plugin compatibility.

In a private directory outside this checkout:

```sh
umask 077
mkdir -p asf/config asf/plugins epic/config
```

Save as `compose.yaml`:

```yaml
services:
  asf:
    image: justarchinet/archisteamfarm:latest
    restart: unless-stopped
    stdin_open: true
    tty: true
    volumes:
      - ./asf/config:/app/config
      - ./asf/plugins:/app/plugins
  epic:
    image: ghcr.io/claabs/epicgames-freegames-node:latest
    restart: unless-stopped
    init: true
    shm_size: 1gb
    mem_limit: 2g
    ports:
      - "127.0.0.1:3300:3000"
    volumes:
      - ./epic/config:/usr/app/config
```

Before starting, save `{"IPC":false}` as `asf/config/ASF.json`. No ASF ports are published: keep IPC disabled. Install a trusted, compatible FreePackages release under `asf/plugins/FreePackages`, preserve its license notices, and configure your bot using upstream instructions. Enable `EnableFreePackages`; review filters such as `Types: ["Game"]`, `NoCostOnly: true` and `IgnoreFreeWeekends: true`. Enter credentials and Steam Guard only on your own machine; interactive prompts can use `docker compose attach asf` (detach with Ctrl-P, Ctrl-Q).

Configure `epic/config/config.json` from upstream instructions, with a notifier you control and `webPortalConfig.baseUrl` pointing to the loopback helper. Keep public tunneling disabled. For remote access, use an authenticated SSH tunnel, not a public port. Epic may require manual device login, checkout or CAPTCHA; unattended claiming is not guaranteed.

```sh
docker compose config --quiet
docker compose up -d
docker compose logs --tail=50
docker compose down
```

Logs and bind mounts may contain credentials, sessions or login links. Restrict directory access, never use `chmod 777`, and never commit these files. Use Steam Guard and Epic 2FA. Back up bind-mounted directories securely while stopped; `docker compose down` preserves them. Define encrypted-backup retention. Back up before pulling updates and check plugin compatibility after upgrades. Automation may fail or conflict with account terms; review upstream guidance before use.

## Provider disclaimer

Snag is independent and is not affiliated with Epic Games, Valve or GamerPower. Store names, trademarks and game assets belong to their respective owners. Offer availability, regional eligibility and claim requirements are controlled by the provider.

---

<div align="center"><sub>Built by <a href="https://github.com/mdprana">Made Pranajaya Dibyacita</a></sub></div>
