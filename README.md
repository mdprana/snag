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

> **In development.** Not deployed or ready for public accounts. Current implementation is a technical foundation, not a finished game-discovery experience.

## Overview

Discover an offer, check its claim window, and open the store to keep it. Snag is being built to bring limited-time game giveaways into one place.

### Available foundation

- **Application shell** with Next.js App Router, React and Tailwind CSS.
- **Database migrations** for libSQL.
- **Session and request utilities** covering origin checks, rate limiting and input validation.
- **Security headers** with a nonce-based Content Security Policy.
- **Configuration validation** and sensitive-field redaction in logs.
- **Automated tests** for database and security utilities.

### In progress

Store feeds, sign-in, claim tracking, browser push notifications and self-hosted claiming. These are planned product flows, not available features. The home page remains a placeholder.

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

These settings are required by the current validator even before push and cron flows are complete. Never commit `.env`, credentials or database files.

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

Tests cover the current foundation, not live provider integrations or finished browser flows.

Additional dependency and secret checks:

```sh
npm run check:audit
npm run check:secrets
```

The secret check requires `gitleaks`; without it, the command reports a skip. A skip is not a clean scan.

## Structure

```text
app/                    Application layout, styles and home page
src/lib/                Database, environment and security utilities
db/migrations/          Versioned SQL migrations
scripts/migrate.ts      Migration runner
tests/                  Utility tests and provider-response fixtures
proxy.ts                Content Security Policy and security headers
```

## Deployment and self-hosting

Public hosting and end-to-end setup are not ready. Deployment instructions, verified screenshots and self-hosted claiming guidance will follow once those flows are exercised. Self-hosted background claiming requires an always-on machine, separate from the hosted web application.

## Provider disclaimer

Snag is independent and is not affiliated with Epic Games, Valve or GamerPower. Store names, trademarks and game assets belong to their respective owners. Offer availability, regional eligibility and claim requirements are controlled by the provider.

---

<div align="center"><sub>Built by <a href="https://github.com/mdprana">Made Pranajaya Dibyacita</a></sub></div>
