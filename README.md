<div align="center">

<img src="public/logo.svg" alt="Snag" width="72" height="72">

# Snag

**Good games. Zero price tag.**

Free-game discovery for **Epic Games Store** and **Steam**.

![Next.js](https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-149eca?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06b6d4?logo=tailwindcss&logoColor=white)
![libSQL](https://img.shields.io/badge/Database-libSQL-4051b5)

[Features](#features) · [Quick start](#quick-start) · [Configuration](#configuration) · [Checks](#checks)

</div>

---

> **Local candidate, not a public-launch certification.** Owner-reported historical Steam sign-in, push delivery and ASF claiming successes do not verify this checkout or every device. Owner reporting is not activated; Epic sign-in remains off pending provider approval and verification. Docker examples are untested.

## Features

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
- **Steam sign-in**, optional Epic sign-in, logout and account deletion. Steam has owner-reported historical success, not a fresh live check of this checkout; Epic login is disabled by default.
- **PWA and notification settings** with installation guidance, device subscriptions, per-store preferences and test notifications. Push has owner-reported historical success; delivery on each target browser, including iPhone Home Screen behavior, still needs operator verification.
- **Privacy and self-host pages**. Optional third-party claiming tools are separate from Snag; their examples have not been tested as a deployment.
- **Automated unit and browser tests** using local data and provider fixtures, not live account credentials.

- **Owner-only status** at `/admin`: latest minimal ASF online report, receipt time, stale warning and latest offer polls. Other accounts and anonymous visitors see the not-found page with no owner data (Next.js streamed responses can retain HTTP 200). Reporter templates are provided but not activated.

### Architecture

Next.js serves pages and authenticated API routes over HTTPS. libSQL stores offers, account-linked records, poll results and one latest ASF report. An external scheduler triggers offer polling. A separate local reporter reads loopback ASF IPC and sends only a bounded status summary to Snag; the web host never connects to IPC. Snag never automatically claims games for public users.

### Verification limits

Historical owner Steam, push and ASF success is separate from current reporter activation and public launch readiness. No deployed revision is certified here. Epic needs provider approval and a live integration check. Third-party Docker recipes remain untested.

## Quick start

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
| `EPIC_LOGIN_ENABLED` | Optional; only exact `true` enables login. Keep `false` until provider approval, configuration and testing. |
| `EPIC_CLIENT_ID` / `EPIC_CLIENT_SECRET` | Required when `EPIC_LOGIN_ENABLED=true`. Keep the secret server-side. |

Presence checks do not verify provider access or key validity. Configuring a variable does not make its associated feature ready.

## Checks

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Unit tests use fixtures and mocked provider responses; they do not verify live provider access or push delivery. Browser checks cover responsive layouts, CSP, artwork, trailer behavior and owner access using synthetic fixtures, not live integration. Browser tests require Playwright Chromium. Run `npx playwright test` for local HTTPS development checks, or build first and run `PLAYWRIGHT_PRODUCTION=1 npx playwright test` for production checks on HTTPS port 3113. Set `PLAYWRIGHT_BROWSERS_PATH` if your browser installation uses a custom location. Tests recreate a disposable fixture database, never the configured application database. Run `node ops/asf-report.check.mjs` for the reporter's isolated self-check.

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

Before accepting public accounts, verify the intended deployment's provider callbacks and push delivery, configure HTTPS and a scheduler, and identify the operator, processors, privacy contact and backup-retention policy. Account deletion in Settings requires typing `DELETE`; it removes account-linked records from the active database, not operator backups or store accounts.

### Offer scheduler

Configure an external scheduler to POST `/api/cron/poll` every 30 minutes, with `Authorization: Bearer <CRON_SECRET>`. GET returns 405; missing or wrong bearer returns 401. There is no built-in scheduler. A poll can send real notifications, so never point development checks at a live instance.

With `APP_URL` and `CRON_SECRET` loaded securely into the operator shell, a manual trigger is:

```sh
curl --fail --silent --show-error --max-time 120 --request POST \
  --header "Authorization: Bearer ${CRON_SECRET}" "${APP_URL}/api/cron/poll"
```

Do not enable shell tracing or log request headers. Check offer freshness and source status after failures; retained offers are not proof of a successful latest poll.

### Optional owner reporter

Templates: [`ops/asf-report.env.example`](ops/asf-report.env.example), [`ops/snag-asf-report.service`](ops/snag-asf-report.service), [`ops/snag-asf-report.timer`](ops/snag-asf-report.timer). These files do not install or configure ASF and are not activated by the app.

The web app needs `OWNER_STEAMID64` and a separate random `ASF_REPORT_SECRET` of at least 32 characters. Sign in through that Steam identity to view `/admin`. The local reporter needs:

| Variable | Reporter requirement |
| --- | --- |
| `APP_URL` | Exact HTTPS Snag origin, no trailing slash. |
| `ASF_IPC_URL` | Optional, defaults to `http://127.0.0.1:1242`; only literal `127.0.0.1` or `[::1]`, HTTP/HTTPS, root path, no credentials/query/fragment. |
| `ASF_BOT` | Exact bot name, 1-64 letters, digits, underscores or hyphens. |
| `ASF_IPC_PASSWORD` | Existing private IPC password, at least 32 characters. Never send it to Snag. |
| `ASF_REPORT_SECRET` | Same separate report secret as the web app, at least 32 characters. |

On the ASF host, store reporter configuration in a private directory with mode 700 and the environment file with mode 600. Keep ASF configuration files mode 600 and Steam Guard enabled. Review the service template's Node path, checkout path and environment-file path before separately installing user units. The template expects the checkout at `%h/snag` and configuration at `%h/.config/snag/asf-report.env`. No service installation or activation is performed by the quick start.

A deliberate manual run, only after reviewing configuration, uses Node's environment-file support:

```sh
node --env-file="$HOME/.config/snag/asf-report.env" ops/asf-report.mjs
```

The timer template sends every five minutes. Both HTTP calls have ten-second timeouts and reject redirects. Reporter accepts at most 1 MiB of IPC JSON, extracts only `IsConnectedAndLoggedOn`, and sends `{ "online": true, "history": "unavailable" }` with the actual boolean. Intake permits at most 1 KiB and 30 authenticated requests per minute, rejects unknown fields and keeps only the latest report. Reports older than 15 minutes show as stale.

Addlicense history is explicitly unavailable: no verified durable last-20-results API was established. Ownership, online state and background key redemption are not evidence of successful free-license claims. Reporter never issues claim commands or uploads raw IPC responses, bot names, credentials or logs. See [ASF IPC documentation](https://github.com/JustArchiNET/ArchiSteamFarm/wiki/IPC); verify compatibility with your installed version before activation. Keep IPC loopback-only; never expose it to the internet or make the web host contact it.

### Database backup and restore

There is no bundled backup script. For a local SQLite database, use SQLite's online backup command rather than copying an active database file. Example assumes `DATABASE_URL=file:snag.db`, a private backup directory and an installed `sqlite3` CLI:

```sh
umask 077
mkdir -p backups
chmod 700 backups
sqlite3 snag.db ".backup 'backups/snag.sqlite3'"
sqlite3 backups/snag.sqlite3 'PRAGMA integrity_check;'
chmod 600 backups/snag.sqlite3
```

Encrypt backups and transfer them to restricted storage. Keep credentials separately protected. Define retention: backups contain identities and push subscriptions, including records deleted after the snapshot. For remote libSQL/Turso, use your provider's documented consistent backup/restore workflow instead; these local-file commands do not back up a remote database.

To restore, stop your app and scheduler through your own process manager first. Preserve the current database and its WAL/SHM files as a rollback set. Restore to a new file, not over an active database:

```sh
sqlite3 backups/snag.sqlite3 'PRAGMA integrity_check;'
sqlite3 restored-snag.db ".restore 'backups/snag.sqlite3'"
chmod 600 restored-snag.db
sqlite3 restored-snag.db 'PRAGMA integrity_check;'
```

Set `DATABASE_URL=file:restored-snag.db` in your protected runtime configuration, run `npm run db:migrate`, then restart your app and verify sign-in, feed and account deletion before re-enabling the scheduler. Restoring also restores old sessions/subscriptions; review revocation and deletion obligations before resuming traffic. These are operator recipes, not a tested disaster-recovery certification.

### Optional claiming tools: untested examples

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
