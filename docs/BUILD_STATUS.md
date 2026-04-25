# Build Status

Last updated: 2026-04-12 21:46 MST

## Current State: Premium UX pass shipped locally; production release candidate still pending deploy plus physical-device touch-map QA

The app builds, passes all automated checks, serves directly from the canonical production host, and has cleared the earlier Wave 2 production verification path on `https://starbucks-pitstop.vercel.app/`. A broader 2026-04-12 premium UX remediation pass is now complete locally across the home shell, search flow, mobile sheet, location page, and map-failure handling. The remaining release gates are deploying that pass and rerunning the literal physical-device touch-map flow on phone hardware. See `docs/QA.md` and `docs/research/verification-summary.md` for the verification chain.

## 2026-04-12 Premium UX remediation pass

- Shipped a whole-app UX refresh without changing the store sync contract or write-security model.
- Home shell changes:
  - reduced first-screen chrome so mobile and desktop give more immediate map area
  - replaced the old mobile `peek` stack with compact teaser states for “start nearby” and selected-store summaries
  - removed the fixed bottom mobile location bar so only one location CTA is visible at a time
  - added a visible drag handle plus swipe thresholds for `collapsed` / `peek` / `open`
- Search and discovery changes:
  - exact single-store matches still auto-select and recenter
  - ambiguous store queries now render an inline result list instead of jumping to an arbitrary first hit
  - place-only geocode fallbacks move the map but keep the panel in `peek`
  - status feedback is now centralized for loading, no-match, and moved-map states
- Accessibility and resilience changes:
  - geolocation is no longer requested on mount; it is gated behind explicit user action
  - search now has an explicit accessible label and live-status messaging
  - markers and clusters expose descriptive labels that include store/code context
  - global `focus-visible` styling and `prefers-reduced-motion` handling were added
  - Mapbox-origin and tile/auth failures now show an intentional recovery surface, including the known localhost-non-`3000` allowlist case
- Standalone store page changes:
  - `/location/[id]` metadata title no longer duplicates the site suffix
  - the page was redesigned to match the premium shell while staying read-only
- Verification completed for the UX pass:
  - `npm run lint` -> pass
  - `npx tsc --noEmit` -> pass
  - `npm run test` -> pass (`108/108`)
  - `npm run build` -> pass
  - `npm run test:e2e` -> pass (`11 passed`, `1 skipped`)
  - local browser spot-checks captured the home state and ambiguous-search state at `375`, `430`, `768`, `1024`, and `1440` widths
- Remaining manual gate:
  - rerun the literal physical iPhone Safari pass for sheet drag, pinch/pan, pin taps, and high-zoom map interaction after deployment

## 2026-04-12 Mobile map shell stabilization

- Root cause 1: the mobile sheet had three logical states in store (`peek`, `open`, `collapsed`) but the rendered sheet still accepted a boolean `open`, so `peek` behaved like fully open and hid the map on first load.
- Root cause 2: the map shell depended on percentage heights through a `min-height` chain. On mobile Safari, Mapbox could finish `onLoad` and emit bounds while its canvas still had an unstable size, which explains the blank white map after collapsing the sheet even though `500 qualifying stores loaded in view` had already been fetched.
- Fixes shipped:
  - `src/components/layout/MobileSheet.tsx` now models `peek`, `open`, and `collapsed` as distinct transforms.
  - `src/components/home/PitstopShell.tsx` now gives the shell a definite `h-dvh` / `min-h-0` flex-height chain and preserves selected-store detail flows instead of auto-peeking them on every viewport commit.
  - `src/components/map/StoreMap.tsx` now forces `map.resize()` on initial load, on sheet-state changes, and when a `ResizeObserver` sees container-size changes.
- Automated verification completed locally:
  - `npm run lint`
  - `npx tsc --noEmit`
  - `npm run test` -> `100/100`

## 2026-04-12 Low-zoom map load shedding for iPhone crash reports

- New user report after the sheet/layout fix: iPhone Safari was still hitting the browser-level "This page couldn't load" screen when tapping clusters or pins.
- Concrete pressure point found in the live map shell: as soon as the map emitted bounds, the home page upgraded from the initial radius query into a nationwide `bbox` query with `limit=500`, even while the viewport was still at the default U.S.-wide zoom.
- Mitigation shipped:
  - added `src/lib/store-load-strategy.ts`
  - defer full bbox loading until zoom `>= 6`
  - cap bbox loads at `200` stores instead of `500`
  - preserve a selected store while low-zoom bbox loading is deferred
- Local verification:
  - `npm run test` -> `100/100`
  - `npm run lint` -> pass
  - `npx tsc --noEmit` -> pass
  - `npm run build` -> pass
  - mobile browser smoke against the updated local app showed the initial state no longer jumping to `500 qualifying stores loaded in view`; after four zoom-in taps it switched into bbox mode with `limit=200`
- Release note: this is a crash mitigation aimed at the strongest verified mobile-Safari pressure spike. The final signoff still requires rerunning the literal phone flow against a deployed build.
  - `npm run test:e2e` -> `6/6`
  - `npm run build`
- Remaining gate: rerun the phone Safari touch-map checklist because this fix specifically targets the blank-canvas behavior observed on a physical iPhone.

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
- Release conclusion: the canonical-host and browser/production evidence gates are closed. One final release gate remains: physical-device touch-map verification.

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

## 2026-04-12 Direct rate-limit and HMAC invariant coverage

- Added `tests/unit/rate-limit.test.ts` to cover the three remaining rate-limit branches called out in the execution board:
  - Upstash configured + under limit -> helper returns allowed
  - Upstash configured + over limit -> helper returns blocked, and `/api/codes` maps that branch to the expected `429` response
  - Upstash absent -> helper exercises the indexed Supabase fallback path and returns the fallback-derived allowance state
- Extended `tests/unit/security-invariants.test.ts` with direct `hashDeviceId` assertions:
  - a pinned deterministic HMAC fixture for a known UUID input + secret
  - an invariant that the raw device ID never appears in the persisted hash output
- Verification:
  - `npm run test` -> `93/93` across `11` files
  - `npx tsc --noEmit` -> pass
  - `npm run lint` -> pass
  - `npm run build` -> pass
- Result: the backend checklist is now closed on direct automated evidence for rate-limit branching and device-ID hashing, not just live-behavior inference.

## 2026-04-12 Touch-device QA scoping decision

- Search is intentionally map-first for this release. The current `handleSearch` flow auto-selects the first store/API match, recenters the map, and opens the detail panel. A separate multi-result tappable search list is not implemented and is treated as a post-release enhancement, not a blocker.
- `MobileSheet.tsx` currently supports button-driven toggle/close controls only. Swipe gestures are not implemented in the sheet component and are accepted for the current release as a non-blocking UX limitation.
- Because Playwright touch synthesis is not authoritative for Mapbox GL pinch/swipe fidelity, the remaining gate is a literal phone-based pass for pinch/pan/high-zoom pin interaction rather than more synthetic browser automation.

## Open Items

1. Run a literal physical-device touch-map spot check on phone hardware: load home page, search and auto-open a known match, pinch-zoom to `z14+`, pan at `z14+`, tap an individual pin, and zoom back out to confirm clean re-clustering.

## Post-release Hardening

1. Provision Upstash before any traffic-scale event if you want production off the DB-backed fallback path. For the current release, the fallback is an explicit, documented acceptance rather than an accidental configuration gap.

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

### 2026-04-13 Phoenix restroom-entry pass

- Added first-class `No Code Required` support to the entry flow without weakening the existing server-mediated write path or hashed-device submission model.
- Expanded code normalization + validation to preserve a trailing `#`, because verified Phoenix entries include `1601#`, `1190#`, and `4268#`.
- Updated user-facing copy so mixed access reports are described as restroom `entries` where appropriate, while keeping voting/history behavior unchanged.
- Added migration `supabase/migrations/20260413170000_seed_phoenix_restroom_entries.sql` to seed seven verified Phoenix-metro entries:
  - `7540` `44th St. & Thomas, Phoenix` -> `23629`
  - `14069` `16th Street & Bethany Home, Phoenix` -> `1601#`
  - `116525` `Rural & Lakeshore, Tempe` -> `78920`
  - `1005596` `7th St. & Osborn, Phoenix` -> `45678`
  - `1007783` `N Scottsdale Rd & N Goldwater, Scottsdale` -> `1190#`
  - `1005602` `28th St & Indian School, Phoenix` -> `4268#`
  - `1022226` `7th & Highland, Phoenix` -> `No Code Required`
- Applied the same seven rows directly to the connected Supabase project and verified they are visible in `public_code_read_model` as active entries with `0` votes.
- At this point in the pass, `Higley & Elliot` was not seeded yet. The live official locator resolved that location as store `1040430` at `49 S Higley Rd`, but the synced store set exposed only an excluded Overture row there (`ambiguous-format`). This was later repaired in the 2026-04-24 follow-up below.
- Verification after this pass:
  - `npm run test` -> `112` tests passed across `16` files
  - `npm run lint` -> passed
  - `npx tsc --noEmit` -> passed
  - `npm run build` -> passed

### 2026-04-24 Phoenix restroom-entry follow-up

- Added migration `supabase/migrations/20260424170000_seed_remaining_phoenix_entries.sql`.
- Repaired `Higley & Elliot` by inserting official Starbucks locator store `1040430` (`49 S Higley Rd`, Gilbert, AZ 85296) into the non-excluded store surface.
- Seeded the two remaining user-confirmed entries:
  - `1040430` `Higley & Elliot, Gilbert` -> `No Code Required`
  - `1009251` `56th Street & Indian School, Phoenix` -> `55498`
- Applied the same changes directly to the connected Supabase project and verified all nine requested Phoenix metro entries through `public_store_read_model` and `public_code_read_model`.
- Verification after this follow-up:
  - `npx supabase db push --linked --yes` -> applied `20260413170000_seed_phoenix_restroom_entries.sql` and `20260424170000_seed_remaining_phoenix_entries.sql`
  - `npx supabase migration list --linked` -> confirmed both seed migrations are present locally and remotely
  - `public_code_read_model` -> confirmed all nine requested Phoenix metro entries are active
  - `npm run test` -> `112` tests passed across `16` files
  - `npm run lint` -> passed
  - `npx tsc --noEmit` -> passed

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

One final release gate remains: the physical-device touch-map pass described above. Everything else is either closed or explicitly accepted as post-release hardening.
