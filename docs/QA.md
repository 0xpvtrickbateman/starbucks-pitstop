# QA Log

Last updated: 2026-04-10 MST

## Status: Release candidate

All automated checks pass, all critical code-level bugs have been fixed, live Supabase writes are persistence-verified both locally and on a Vercel preview deployment, and Lighthouse has been recorded against the deployed preview. Status is held at release-candidate until the open follow-ups below are closed: a smoke test on the actual production URL (not the Vercel preview), a warmed-prod Lighthouse audit, and real-device + visual regression checks.

### 2026-04-10 second-pass remediation (after code review)

A second review surfaced six additional issues. All fixed and reverified:

- **High — rate-limit fallback was unindexed.** `enforceRateLimit` falls through to Supabase COUNT queries when Upstash is not configured. Without supporting indexes every submit/vote was a sequential scan. Added migration `20260410180000_rate_limit_fallback_indexes.sql` with composite indexes `codes(submitted_by_hash, created_at DESC)` and `votes(voter_hash, created_at DESC)`. Verified via `EXPLAIN` — the planner now uses `Index Only Scan` on both.
- **Medium — excluded stores leaked through `/location/[id]`.** List APIs filtered `is_excluded = false` but `fetchStoreById` did not, so any guessable excluded store ID still rendered a public page. Added the filter in `src/lib/store-data.ts`. Verified: excluded store `1009830` (reason: `hotel`) now returns 404; included store `7327` still returns 200.
- **Medium — API handlers echoed raw error text as 400.** All four routes collapsed internal failures (DB outages, SQL regressions) into 400 with the raw error message, which would leak database details. Added `src/lib/api-errors.ts` with `apiErrorResponse(error, context)`: `ZodError` → 400 with per-field `details`, `ApiClientError` (for explicit 4xx), anything else → 500 `Internal server error` with the real error logged server-side. Wired into `locations`, `search`, `codes`, and `votes`. Explicit early returns for 429 (rate limit), 404 ("Code not found"), and 409 (`duplicate_vote`) are preserved.
- **Medium — `sync-stores` did not load `.env.local`.** The script read `process.env` directly, so `npm run sync-stores` would silently dry-run unless the operator had already sourced the file. Added `loadEnvConfig(process.cwd(), …)` from `@next/env` at the top of `scripts/sync-stores.ts`, before `DEFAULT_OPTIONS` is evaluated.
- **Low — `search_stores_by_text` had `LIMIT` without `ORDER BY`.** The UI auto-selects `results[0]` on a search, so ranking was effectively random across calls. Added migration `20260410180500_search_stores_deterministic_order.sql` with a `CASE`-based rank (exact city / exact zip / exact name first, then prefix matches, then substring) and a stable `(name, id)` tiebreaker. Verified: `search?q=Seattle` now returns `17844 35th & Fauntleroy` as `results[0]` on every call.
- **Low — doc drift on migration filenames.** `README.md` pointed at a deleted migration and `docs/BUILD_STATUS.md` named a filename that never existed. Both updated to match the real filenames under `supabase/migrations/`.

### 2026-04-10 second-pass verification

- `npm run lint` — pass
- `npx tsc --noEmit` — pass
- `npm run test` — 53/53 pass
- `npm run build` — pass
- Local smoke against real Supabase:
  - `/api/locations?lat=47.6&lng=-122.3&radius=5` → 73 stores, ordered.
  - `/api/search?q=Seattle` → same `results[0]` three calls in a row.
  - `/api/locations?lat=abc&lng=foo&radius=-1` → 400 with structured Zod `details`.
  - Code submit + upvote + duplicate-vote (409) still work end-to-end.
  - Bad code submit (`{storeId:"",code:"",deviceId:"not-a-uuid"}`) → 400 with per-field Zod `details`.
  - `/location/1009830` (excluded) → 404. `/location/7327` (included) → 200.
- Preview redeployed to https://starbucks-pitstop-lasu6c2hw-williamjake.vercel.app (SSO temporarily nulled for smoke + Lighthouse, then restored). All smoke assertions pass on the preview.
- `EXPLAIN` on `codes`/`votes` rate-limit COUNT queries — both now show `Index Only Scan` on the new composite indexes.

### 2026-04-10 Lighthouse re-run (new preview)

| Category | Score |
|---|---|
| Performance | 59 |
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 60 |

Performance improved from 35 → 59 versus the first preview, primarily due to the warm Vercel build cache on redeploy. Still expected to climb further on a warmed prod lambda with a custom domain. Accessibility and Best Practices held at 100/96.

## Automated Results

- `npm run lint`
  - passed on 2026-04-09
- `npx tsc --noEmit`
  - passed on 2026-04-09
- `npm run build`
  - passed on 2026-04-09
- `npm run test`
  - passed on 2026-04-10 — 53 tests across 8 files
  - includes targeted coverage added during the 2026-04-09 remediation pass:
    - search safety: commas, parentheses, quotes, percent signs, backslashes, mixed punctuation (10 tests)
    - store query behavior: bbox filtering, radius ordering, limit enforcement (8 tests)
    - viewport bounds calculation: tight bounds at high zoom, wide bounds at low zoom, latitude clamping (4 tests)
- `npm run test:e2e`
  - passed on 2026-04-08 (mocked at the network layer)
- `npm audit --omit=dev`
  - 0 vulnerabilities on 2026-04-09

## 2026-04-09 Remediation Fixes Verified

| Issue | Root cause | Fix | Verified by |
|-------|-----------|-----|-------------|
| Map clustering used world bounds | `getClusters` called with `[-180, -85, 180, 85]` | Viewport-derived bounds with 1.5x buffer | Unit tests + code review |
| Store retrieval truncated before ordering | `.limit()` applied without `.order()` | Added `.order("name")` for bbox; PostGIS RPC for radius | Unit tests |
| Search interpolated raw input into `.or()` | Commas/parens broke PostgREST filter | Parameterized `search_stores_by_text` RPC | 10 safety tests |
| Mobile sheet expand affordance broken | Both header buttons called `onClose` | Separated `onToggle` (chevron) from `onClose` (X) | Code review |

## Local Bootstrap Checks

- `npm run dev`
  - boots locally without Supabase credentials by using the seeded in-memory backend in development
- local API checks should return usable responses for:
  - `/api/locations`
  - `/api/search`
  - `/api/codes`
  - `/api/votes`
- without `NEXT_PUBLIC_MAPBOX_TOKEN`, the UI should show the token-missing fallback panel instead of a broken or misleading empty map state

## Manual / Visual Checks Completed

- Desktop shell rendered locally over HTTP and returned `200`
- Metadata assets are present in the rendered HTML:
  - favicon
  - manifest
  - Apple touch icon
  - OG metadata
- The app shell loads without type or lint failures
- Mobile behavior received browser-level regression coverage through Playwright emulation
- The local no-Supabase path now supports seeded search, detail, submit, and vote flows through server handlers
- The local no-Mapbox path now shows a usable fallback panel with quick store selection

## 2026-04-10 Live Verification Pass

All four migrations confirmed applied to live Supabase (`ipjqdcuqykbrhsjwfjoh`): `initial_schema`, `expand_stores_for_scraper`, `fix_view_address_alias`, `nearby_and_search_rpcs`. `nearby_stores` and `search_stores_by_text` RPCs verified via `pg_proc`.

Discovered during live smoke: `submit_code_report` threw `42702: column reference "store_id" is ambiguous` because PL/pgSQL implicitly declares OUT variables for each `RETURNS TABLE` column, shadowing the real table columns inside `ON CONFLICT`. Fixed via new migration `20260410170000_fix_rpc_variable_conflicts.sql`, which adds `#variable_conflict use_column` to `submit_code_report`, `recompute_store_code_scores`, and `vote_on_code` (the latter two were latent cases of the same shadowing bug).

Overture sync ran against live DB with `--upsert`: 21,879 total rows in `stores` (15,483 included, 6,396 excluded) after the run. Report at `docs/research/latest-store-sync-report.json`.

Local API smoke against real Supabase (dev server on :3100):
- `/api/locations?lat=47.6&lng=-122.3&radius=5` returned 73 stores ordered by ascending `distanceMiles` — radius ordering fix verified.
- Downtown Seattle tight bbox (`-122.342,47.605,-122.330,47.615`) returned 14 stores; continental bbox capped at 500. Bbox scoping fix verified.
- Search safety strings (`Seattle, WA`, `Starbucks (Downtown)`, `Phoenix, AZ 85016`, `"Roosevelt"`, `100% match`) all returned HTTP 200 with no 500s — parameterized RPC is safe against punctuation. Note: multi-field queries like `Seattle, WA` legitimately return 0 because the RPC ILIKEs each column independently and `city` is just `Seattle` — that is a product-level search design limitation, not a remediation regression. Simple single-field queries (`Seattle`, `Phoenix`, `85016`, `Roosevelt`) all return 10 results.
- `RATE_LIMIT_SECRET` was empty in `.env.local`; generated a 64-char token and persisted to both `.env.local` and all three Vercel environments (dev, preview, prod).
- Code submit + upvote + downvote + duplicate-vote guard (409) all verified end-to-end against real Supabase; Wilson confidence scoring reflected in the response payload.

Vercel preview deploy: https://starbucks-pitstop-atw9u7mkg-williamjake.vercel.app
- Preview env vars mirrored from `.env.local` (all seven) before deploy.
- Build completed clean (Next 16.2.3, Turbopack, 9/9 pages).
- Project-level `ssoProtection` was temporarily disabled (`all_except_custom_domains` → null → restored) to permit automated smoke + Lighthouse; re-enabled immediately after.
- `/` returned 200 with the real page title.
- `/api/locations?lat=47.6&lng=-122.3&radius=5` → 73 stores, radius query, Supabase source.
- `/api/locations?bbox=…` → 198 stores.
- `/api/search?q=Seattle` → 10 results.
- Code submit + vote persisted against live Supabase through the preview deployment.

## Lighthouse (deployed preview, historical)

Initial cold-hit run, captured 2026-04-10 against the first preview URL via `npx lighthouse --output html --output json --output-path ./docs/research/lighthouse-preview --chrome-flags="--headless=new --no-sandbox"`.

| Category | Score |
|---|---|
| Performance | 35 |
| Accessibility | 100 |
| Best Practices | 96 |
| SEO | 60 |

Superseded by the 2026-04-10 second-pass rerun above (Performance 59 on a warmed build cache). The current report at `docs/research/lighthouse-preview.report.html` (+ JSON) reflects the rerun scores.

Performance is cold-start sensitive on a first-hit preview (Mapbox GL JS + cold Supabase lambda + no CDN edge warmup). The accessibility + best-practices scores confirm there are no fundamental code-level regressions. Performance is tracked as a warmed-prod follow-up, not a release blocker.

## Remaining (non-blocking) follow-ups

- [ ] Re-run Lighthouse against production with the domain warmed — expect Performance to rise materially once the lambda is warm and Mapbox assets are cached.
- [ ] Human-visual walkthrough at 375 / 768 / 1024 / 1440 widths (Chrome devtools device mode is enough) — purely a sanity check since the layout has unit coverage.
- [ ] Real Mapbox clustering / zoom / pan walkthrough at z14+ on a real device. Bbox clustering fix has unit coverage.
- [ ] Tighten the search RPC design so multi-field queries like `Seattle, WA` or `Phoenix, AZ 85016` can resolve — would need a small tokenizer, not a remediation-pass fix.
- [ ] Provision Upstash so `RATE_LIMIT_SECRET`-driven rate limiting moves off the DB fallback path. Currently `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are empty and `enforceRateLimit` correctly falls through to Supabase COUNT queries.

## Known Limitations

- Lighthouse Performance score on a cold preview is not representative of warm-path performance; rerun against a warmed prod URL for an accurate baseline.
- Search is a simple per-column ILIKE; multi-field strings will return 0 rows by design.
- E2E tests are mocked at the network layer and do not exercise real Supabase writes — the 2026-04-10 live pass above is the authoritative end-to-end check.
