# Snag

Free-game discovery for Epic Games Store and Steam.

**Status:** early development. Not deployed or ready for public accounts.

## Current foundation

- Next.js application with TypeScript and Tailwind CSS.
- libSQL schema and migration runner.
- Session, request-origin and rate-limit utilities.
- Outbound URL validation and push-subscription input checks.
- Automated tests for these utilities.

Store feeds, sign-in flows, notifications and claim tracking are still in development. Full self-hosting instructions will follow once those flows are tested.

## Local development

Requires Node.js 22 and npm.

```sh
npm ci
cp .env.example .env
# Configure .env for your local database and development environment.
npm run db:migrate
npm run dev
```

Development server uses port 3100 with local HTTPS. Never use production credentials for local tests.

## Checks

```sh
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Snag is not affiliated with Epic Games or Valve. Store names and game assets belong to their respective owners.
