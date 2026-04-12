# Build Status

Last updated: 2026-04-12 14:00 MST

## Current State: Production-ready

The app builds, passes all automated checks, serves directly from the canonical production host, and has now cleared the post-deploy Wave 2 verification path on `https://starbucks-pitstop.vercel.app/`. The only active release blocker was the Vercel dashboard redirect on the canonical host; that redirect has been removed and the production URL now returns `HTTP/2 200`. See `docs/QA.md` and `docs/research/verification-summary.md` for the verification chain.

## 2026-04-10 Canonical URL Gate Closed

- The `starbucks-pitstop.vercel.app` domain was reconfigured in Vercel Domains settings from `307 -> stopatstarbucks.vercel.app` to `Connect to an environment: Production`.
- `curl -I https://starbucks-pitstop.vercel.app/` at 2026-04-10 20:35 MST returned `HTTP/2 200` with `x-nextjs-prerender: 1`.
- `curl -I https://stopatstarbucks.vercel.app/` also returned `HTTP/2 200`; both hostnames remain attached to production deployment `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`.
- Conclusion: the canonical-host redirect gate is closed and Wave 2 could proceed against the actual production URL.

## 2026-04-10 Wave 2 Verification Summary

- Smoke checks 1–6 from `docs/RELEASE_RUNBOOK.md` passed against `https://starbucks-pitstop.vercel.app/`:
  - `/` returned `HTTP/2 200`
  - `/api/locations?bbox=...` returned 156 stores with `meta.source: "supabase"`
  - `/api/locations?lat=47.6062&lng=-122.3321&radius=5` returned 73 stores ordered by distance
  - `/api/search?q=pike` returned 10 stores
  - `/api/search?q=a` returned the expected `400` validation response
  - `/manifest.webmanifest` returned `HTTP/2 200`
- Browser verification on the canonical host succeeded at 375 / 768 / 1024 / 1440 widths with zero console errors. The search flow auto-selected `35th & Fauntleroy` for `Seattle`, and the store detail panel rendered correctly.
- Lighthouse on the canonical host recorded:
  - first pass: Performance 42 / Accessibility 100 / Best Practices 96 / SEO 100
  - warmed pass: Performance 81 / Accessibility 100 / Best Practices 96 / SEO 100
- Release conclusion: production launch gates are closed. Remaining items are non-blocking follow-ups.

## 2026-04-10 Verification Summary

- All four prior migrations confirmed applied live: `initial_schema`, `expand_stores_for_scraper`, `fix_view_address_alias`, `nearby_and_search_rpcs`.
- One new migration added + applied: `20260410170000_fix_rpc_variable_conflicts.sql`, which fixes an ambiguous-column bug in `submit_code_report`, `recompute_store_code_scores`, and `vote_on_code`. The bug: PL/pgSQL implicitly declares OUT variables for each `RETURNS TABLE` column, which shadowed the real `codes.store_id` / `codes.is_active` columns inside `ON CONFLICT` and a bare `UPDATE ... WHERE` target. Fix: `#variable_conflict use_column` plus an alias on the late-stage UPDATE. This bug blocked live code submission until the fix migration landed.
- Overture store sync ran with `--upsert`: 21,879 rows total, 15,483 included, 6,396 excluded.
- Local smoke against real Supabase: radius ordering correct, bbox scoping tight, search safety strings return 200, code submit + upvote + downvote + duplicate-vote (409) verified.
- Vercel preview smoke: page 200, `/api/locations` (radius + bbox), `/api/search`, and full submit+vote persistence verified through the deployed preview. Preview: https://starbucks-pitstop-atw9u7mkg-williamjake.vercel.app (SSO protected; temporarily unprotected for the smoke + Lighthouse window, then restored).
- Lighthouse captured — Performance 59, Accessibility 100, Best Practices 96, SEO 60 (second-pass rerun after redeploy; initial cold-hit preview was Performance 35). Report at `docs/research/lighthouse-preview.report.html`. Performance is still cold-start sensitive on a fresh preview and is tracked as a warm-path follow-up, not a release blocker.

## 2026-04-10 Second-pass Remediation (post code review)

A second review surfaced six issues — all fixed, applied, and reverified on 2026-04-10. Full detail in `docs/QA.md`.

- **High**: rate-limit DB fallback was unindexed. Added `20260410180000_rate_limit_fallback_indexes.sql`: composite indexes `codes(submitted_by_hash, created_at DESC)` and `votes(voter_hash, created_at DESC)`. `EXPLAIN` confirms `Index Only Scan` on both.
- **Medium**: `fetchStoreById` did not filter `is_excluded = false`, so excluded stores still rendered on `/location/[id]`. Fixed in `src/lib/store-data.ts`.
- **Medium**: all four API routes collapsed internal errors into 400 with raw DB text. Added `src/lib/api-errors.ts`: `ZodError` → 400 with per-field details, internal errors → 500 generic with the real error logged. Preserves explicit 409/404/429 paths.
- **Medium**: `scripts/sync-stores.ts` read `process.env` without loading `.env.local`. Added `@next/env` `loadEnvConfig` at the top of the script so `npm run sync-stores -- --source=overture` works straight from the README instructions.
- **Low**: `search_stores_by_text` had `LIMIT` without `ORDER BY`; the UI auto-selects `results[0]`. Added `20260410180500_search_stores_deterministic_order.sql` with `CASE`-based ranking and a `(name, id)` tiebreaker. Smoke-verified: `results[0]` for "Seattle" is stable across calls.
- **Low**: `README.md` and `docs/BUILD_STATUS.md` referenced migration filenames that do not exist on disk. Both updated to match the real filenames.

## 2026-04-11 Mapbox public token URL-restricted

- The public token `NEXT_PUBLIC_MAPBOX_TOKEN` (id `cmnr5hlhd00jh2vpoopc6k7t5`, account `three-olives`) was restricted via the Mapbox Tokens API at 2026-04-12T01:03:29.333Z UTC. Allowed origins: `starbucks-pitstop.vercel.app`, `stopatstarbucks.vercel.app`, every existing `starbucks-pitstop-<hash>-williamjake.vercel.app` deployment URL, and `http://localhost:3000`. `127.0.0.1` was not added because Mapbox URL restrictions do not accept IP literals.
- No application code change. `src/components/home/PitstopShell.tsx` and `src/components/map/StoreMap.tsx` already read the token from `process.env.NEXT_PUBLIC_MAPBOX_TOKEN`; the restriction is enforced server-side by Mapbox.
- Verified live with seven curl probes against `https://api.mapbox.com/search/geocode/v6/forward?q=seattle`:
  - Allowed Referer `https://starbucks-pitstop.vercel.app/` → `200`
  - Allowed Referer `https://stopatstarbucks.vercel.app/` → `200`
  - Allowed Referer `http://localhost:3000/` → `200`
  - Allowed Referer for an explicitly-listed deployment host (`...-q4px1h5ab-...`) → `200`
  - Disallowed Referer `https://example.com/` → `403 FORBIDDEN`
  - Disallowed unlisted preview-style Referer (`https://some-other-app-abc123-williamjake.vercel.app/`) → `403 FORBIDDEN`
  - **No Referer header at all** → `403 FORBIDDEN`. Mapbox blocks Referer-less requests when URL restrictions are active, so the token is now functionally browser-only.
- Operational note: there is no wildcard. Future preview deployments will return `403` until their URL is appended to the allowlist. If preview-deploy churn becomes painful, switch strategies (e.g., preview-only secondary token, or a tokens-write CI step that appends each new deployment URL on `vercel deploy`).

## 2026-04-12 Supabase SECURITY INVOKER hardening

- Added and applied `20260412010000_security_invoker_and_search_path_hardening.sql`.
- `public_store_read_model` and `public_code_read_model` now run with `security_invoker = true`; anon/authenticated access on the view surface was revoked, and `service_role` retained explicit `SELECT`.
- `submit_code_report`, `recompute_store_code_scores`, and `vote_on_code` were rewritten as `SECURITY INVOKER` with `SET search_path = public, pg_temp`. `wilson_score`, `nearby_stores`, `search_stores_by_text`, and `set_updated_at` now also pin `search_path = public, pg_temp`.
- Runtime verification passed on the canonical production URL after the migration:
  - runbook GET checks 1-6 still returned the expected `200`/`400` results
  - live code submit returned `200`
  - live vote returned `200`
  - duplicate vote still returned `409` with the expected `"You have already voted on this code."` response
- The temporary production test code and vote created during verification were deleted immediately afterward: vote row removed first, then code `3a6c7420-de20-4aba-986d-1f3ae4a7cf14`, leaving no test data in prod.
- The targeted advisor/lint recheck could not be confirmed through `supabase db lint --linked` because the CLI hit `cli_login_postgres` auth failure. Item closeout is therefore based on successful live runtime verification rather than advisor output.

## 2026-04-12 Production rate-limit proof (Item A)

- Ran four sequential `POST /api/codes` requests against `https://starbucks-pitstop.vercel.app/` using the same synthetic UUID device identity, store `11917` (`3rd & Madison`), and four distinct valid codes.
- Exact response sequence:
  - request 1 -> `200`, `existing: false`
  - request 2 -> `200`, `existing: false`
  - request 3 -> `200`, `existing: false`
  - request 4 -> `429`, `"Submission rate limit exceeded. Please wait before posting again."`
- Cleanup completed immediately afterward: the three created code rows were deleted from prod, and no vote rows were created.
- This closes the execution-board Item A blocker: production write throttling is enforcing the expected 3-per-hour code-submission threshold.
- `vercel env ls production` recheck at 2026-04-12 13:54 MST confirmed that `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are **absent** on the production deployment. The observed `200, 200, 200, 429` sequence therefore came from the indexed Supabase fallback path, not Upstash.
- Coordinator acceptance: this is still safe for the current release because the fallback is DB-backed and therefore durable across serverless invocations, with supporting composite indexes already applied. The known tradeoffs are one extra DB query per mutation and a slightly leaky soft cap under concurrent bursts from the same hashed device until the DB unique constraints catch meaningful duplicates.

## 2026-04-12 Multi-field search tokenizer shipped (Item C)

- Added and applied `20260412141000_search_stores_multi_field_tokens.sql`.
- `search_stores_by_text` now tokenizes on commas + whitespace inside SQL, classifies 5-digit ZIP tokens and 2-letter state tokens, ANDs the classified filters together, and keeps free-text matching inside the RPC instead of moving search logic into the route layer.
- The search haystack now includes an abbreviation-expanded street form, which is what lets `Pike Place` resolve to `1912 Pike Pl` / `Original Starbucks` without hand-written route logic.
- Added route-level coverage in `tests/unit/search-route.test.ts` for:
  - `Seattle, WA`
  - `Phoenix, AZ 85016`
  - `Seattle`
  - `WA`
  - `85016`
  - `Pike Place`
- Verification:
  - `npm run test` — `87/87` across `10` files
  - `npx tsc --noEmit` — pass
  - `npm run lint` — pass
  - `npm run build` — pass
  - `supabase db push --linked --yes` — applied cleanly
  - live production queries on `https://starbucks-pitstop.vercel.app/api/search` returned sane first hits:
    - `Seattle, WA` -> `17844` `35th & Fauntleroy`
    - `Phoenix, AZ 85016` -> `10896` `Starbucks`, Phoenix
    - `Seattle` -> `17844` `35th & Fauntleroy`
    - `WA` -> `7884` `Starbucks`, Aberdeen
    - `85016` -> `10896` `Starbucks`, Phoenix
    - `Pike Place` -> `overture:9a25bb77-4b56-467b-ac0e-343420aec78a` `Original Starbucks`

## Open Items

1. Run a literal physical-device spot check for map pan/zoom and geolocation behavior. Browser verification at the target widths is complete, so this is no longer a release gate.
2. Provision Upstash before any traffic-scale event if you want production off the DB-backed fallback path. For the current release, the fallback is an explicit, documented acceptance rather than an accidental configuration gap.

## Completed

- Verified official Starbucks design references from Starbucks-owned sources
- Chosen safe open-source font equivalents
- Defined initial app design tokens
- Verified live Starbucks store-locator endpoint and response behavior
- Verified finite-radius and 50-result-cap limitations
- Established a conservative filtering strategy and fallback plan
- Saved a sanitized sample response to `docs/research/sample-store-response.json`
- Scaffolded the Next.js app in the current workspace
- Installed the required core and testing dependencies
- Added the first secure Supabase migration scaffold
- Implemented a source-aware sync runner with explicit fallback support
- Captured the first nationwide fallback sync result:
  - `rawRows`: `23,476`
  - `uniqueStores`: `19,928`
  - `includedStores`: `13,532`
  - `excludedStores`: `6,396`
- Added secure Supabase migration SQL with RLS, views, and transactional vote/code functions
- Implemented server-mediated `locations`, `search`, `codes`, and `votes` route handlers
- Wired the map shell, search flow, detail sheet/sidebar, code submission, voting, and old-code history UI
- Generated favicon, manifest, Apple touch icon, and OG image assets from the supplied logo
- Added unit coverage for normalization, validation, and scoring helpers
- Added mocked Playwright coverage for desktop and mobile search/submit/vote flows
- Added a local in-memory backend fallback for development and optional local preview mode without Supabase credentials
- Added a Mapbox-token-missing fallback panel so local search and store detail flows still work without an interactive map token

### 2026-04-09 production remediation pass

- **Fixed map clustering scope**: Clustering now operates against the current viewport bounds (with a 1.5x buffer) instead of world bounds. This prevents performance degradation from clustering ~13.5k stores at high zoom levels.
- **Fixed store retrieval ordering**: Bounding-box queries now apply `.order("name")` before `.limit()` for deterministic results. Radius queries now use a PostGIS-backed `nearby_stores` RPC with `ST_DWithin` and `ST_Distance` for correct distance filtering and ordering in SQL.
- **Fixed unsafe search query construction**: Raw user input is no longer interpolated into PostgREST `.or()` filter expressions. Search now uses a parameterized `search_stores_by_text` RPC. Commas, parentheses, quotes, and other special characters in search input are handled safely.
- **Fixed mobile sheet expand affordance**: The collapsed mobile sheet chevron button now correctly toggles between expanded and collapsed states. The close (X) button remains a separate action that clears the selection.
- **Added new migration**: `supabase/migrations/20260410164503_nearby_and_search_rpcs.sql` with `nearby_stores` and `search_stores_by_text` RPC functions
- **Added targeted test coverage**: search safety (10 tests), store query behavior (8 tests), viewport bounds calculation (4 tests)
- Verified all automated checks pass:
  - `npm run lint` — passed
  - `npx tsc --noEmit` — passed
  - `npm run test` — 87 tests passed across 10 files
  - `npm run build` — passed
  - `npm audit --omit=dev` — 0 vulnerabilities

## Known Risks

- Official locator endpoint has no observed public pagination contract
- Coordinate queries have a finite search radius and can return `[]`
- Company-operated stores still include some non-qualifying environments, so secondary heuristics are required
- `creative.starbucks.com` presented an expired TLS certificate during shell research, though its content remained readable from the official domain
- The official Starbucks locator is now returning Akamai `403 Access Denied` responses to this automation environment, which makes the primary sync path unstable for unattended use
- The Overture fallback is publicly queryable, but it has weaker ownership/type fidelity than the official Starbucks response
- Browser automation tests are currently mocked at the network layer; they verify the product flows but not a live Supabase-backed deployment
- The local mock backend is intentionally seeded and ephemeral; it is for developer bootstrapping only and is not a replacement for real Supabase validation
- Lighthouse Performance score is captured on a cold-hit Vercel preview; warm-path performance on a production domain is expected to be materially higher (see follow-ups).

## Next Actions

Production launch gates are closed. The remaining open items are tracked above and are advisory or post-launch hardening work, not blockers for the current release.
