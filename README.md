# Starbucks Pitstop

Starbucks Pitstop is a Next.js app for crowdsourcing restroom keypad codes at Starbucks locations. It is optimized for quick phone-in-hand usage: open the map, find a nearby store, check the current user-reported code, or submit/vote anonymously.

This project is not affiliated with Starbucks. Restroom codes are user-reported and may change.

## What is verified

- The official Starbucks store locator contract was reverse engineered from `https://www.starbucks.com/store-locator`.
- Verified endpoint:
  - `https://www.starbucks.com/apiproxy/v1/locations`
- Verified blocker:
  - after the initial research phase, automated requests from this environment began returning Akamai `403 Access Denied`
- Active sync fallback:
  - Overture Maps places release `2026-02-18.0`

See:

- `docs/DESIGN.md`
- `docs/DECISIONS.md`
- `docs/STORE_SYNC_REPORT.md`
- `docs/BUILD_STATUS.md`

## Stack

- Next.js App Router
- Tailwind CSS
- Supabase
- Mapbox GL via `react-map-gl`
- `supercluster`
- Zod validation
- Upstash rate limiting when configured

## Environment

Copy `.env.example` to `.env.local` and provide:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_MAPBOX_TOKEN`
- `RATE_LIMIT_SECRET`
- `UPSTASH_REDIS_REST_URL` optional but recommended
- `UPSTASH_REDIS_REST_TOKEN` optional but recommended
- `OVERTURE_RELEASE` optional, defaults to `2026-02-18.0`

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database setup

Apply the SQL migrations in `supabase/migrations/`.

Current migration:

- `supabase/migrations/202604080001_initial_schema.sql`

Key database guarantees:

- no direct anon writes to `codes` or `votes`
- hashed/HMAC’d device IDs only
- transaction-safe vote recomputation via SQL function
- historical codes preserved even after deactivation

## Store sync

Dry-run the current fallback pipeline:

```bash
npm run sync-stores -- --dry-run --source=overture
```

Reuse the already exported Overture file when iterating on filters:

```bash
npm run sync-stores -- --dry-run --source=overture --reuse-export
```

If the official Starbucks source becomes automation-safe again, the sync runner still keeps that logic in place, but the current documented production path should be treated as:

- official Starbucks locator for research and contract verification
- Overture fallback for unattended sync from this environment

## Sync notes

- Overture export file:
  - `docs/research/latest-overture-starbucks-us.json`
- Sync report:
  - `docs/research/latest-store-sync-report.json`
- Current dry-run included-store count:
  - `13,532`

The fallback is intentionally conservative and excludes low-confidence records without an official Starbucks `store-locator/store/<id>` URL anchor.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
- `npm run test`
- `npm run test:e2e`
- `npm run sync-stores`

## Testing

Current verified commands:

```bash
npm run lint
npm run build
npm run test
npm run test:e2e
```

`npm run test:e2e` uses mocked API responses so the core UI flows can be validated without a live Supabase project.

## Deployment

Target platform:

- Vercel

Recommended deployment order:

1. Create the Supabase project and apply migrations.
2. Set all environment variables in Vercel.
3. Run the store sync with real Supabase credentials.
4. Deploy the Next.js app.
5. Verify location queries, code submission, and voting from the deployed environment.

## Sync cadence

Recommended starting cadence:

- run `scripts/sync-stores.ts` once every 24 hours
- rerun manually after documented filtering changes
- keep the run idempotent by relying on store ID upserts and deterministic exclusion reasons

Manual invocation:

```bash
npm run sync-stores -- --source=overture
```

## Known limitations

- The current unattended sync path uses Overture fallback data because the official Starbucks source blocked automation from this environment.
- Overture does not expose the same ownership and amenity detail as the official Starbucks response, so fallback inclusion/exclusion is more conservative and less exact.
