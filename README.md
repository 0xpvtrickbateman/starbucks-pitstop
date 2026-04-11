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
- `STARBUCKS_PITSTOP_LOCAL_MOCK` optional, set to `1` to force the local in-memory backend without Supabase

Blank values in `.env.local` are treated as unset so the template can be copied safely.

## Install

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Local development fallback behavior:

- when Supabase credentials are missing in `development`, the app falls back to a seeded in-memory backend so search, store details, code submission, and voting still work locally
- if you want the same fallback while running `npm run build` and `npm run start`, set `STARBUCKS_PITSTOP_LOCAL_MOCK=1`
- if `NEXT_PUBLIC_MAPBOX_TOKEN` is missing, the interactive map is replaced with a local fallback panel; the rest of the product still works

## Database setup

Apply the SQL migrations in `supabase/migrations/` in filename order (`supabase db push` handles this automatically once the project is linked).

Current migrations:

- `20260409070148_initial_schema.sql` — base tables, RLS, RPCs, views
- `20260409073115_expand_stores_for_scraper.sql` — additional store columns
- `20260409073142_fix_view_address_alias.sql` — read-model view alias fix
- `20260410164503_nearby_and_search_rpcs.sql` — PostGIS `nearby_stores` + parameterized `search_stores_by_text`
- `20260410170000_fix_rpc_variable_conflicts.sql` — `#variable_conflict use_column` for `submit_code_report`, `recompute_store_code_scores`, `vote_on_code`
- `20260410180000_rate_limit_fallback_indexes.sql` — composite indexes on `codes(submitted_by_hash, created_at)` and `votes(voter_hash, created_at)` to support the DB rate-limit fallback
- `20260410180500_search_stores_deterministic_order.sql` — stable ranking + tiebreaker in `search_stores_by_text`

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

`npm run dev` now also supports a local in-memory backend when Supabase credentials are absent, which keeps the repo usable on a fresh machine.

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

## Production status

**Production-ready as of 2026-04-10 20:38 MST.** The canonical host `https://starbucks-pitstop.vercel.app/` now serves the production deployment directly, the Wave 2 smoke suite passes on the canonical production URL, a warmed production Lighthouse audit recorded Performance 81 / Accessibility 100 / Best Practices 96 / SEO 100, and browser verification on the canonical host succeeded at 375 / 768 / 1024 / 1440 widths. Full verification log in `docs/QA.md`, `docs/BUILD_STATUS.md`, and `docs/research/verification-summary.md`.

## Known limitations

- The current unattended sync path uses Overture fallback data because the official Starbucks source blocked automation from this environment.
- Overture does not expose the same ownership and amenity detail as the official Starbucks response, so fallback inclusion/exclusion is more conservative and less exact.
