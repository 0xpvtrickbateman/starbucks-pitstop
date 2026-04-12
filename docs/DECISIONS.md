# Decisions Log

Last updated: 2026-04-11 MST

## 2026-04-08: Use the official Starbucks locator as the primary ingestion source

Decision:

- Use `https://www.starbucks.com/apiproxy/v1/locations` as the primary store source.

Why:

- The endpoint is currently live and verifiable from the official `store-locator` page.
- The response includes enough structure to support store caching and conservative filtering.

Evidence:

- verified same-origin requests from `https://www.starbucks.com/store-locator`
- verified live responses for `place=...` and `lat=...&lng=...`

Risk:

- no public pagination contract was observed
- dense queries truncate at `50`
- radius-limited coordinate queries can return `[]` if the query point is too far from any store

Mitigation:

- build an overlapping adaptive sync strategy instead of relying on a single national query

Update:

- after initial verification, Akamai `403 Access Denied` responses blocked subsequent automation requests from this environment
- because the source became unstable for unattended sync use, the app now needs an explicit documented fallback path

## 2026-04-08: Switch the sync fallback to Overture Maps when the official source blocks automation

Decision:

- Keep the official Starbucks locator as the preferred researched source.
- When it returns automation-blocking `403` responses, switch explicitly to the Overture Maps places dataset instead of silently degrading or scraping around the block.

Why:

- the user explicitly required a documented fallback if the official source became blocked or impractical
- Overture provides public, queryable U.S. place data with Starbucks brand signals and many official Starbucks store URLs
- it avoids leaning on a flaky or access-controlled sync contract

Tradeoff:

- Overture lacks ownership and amenity richness, so inclusion/exclusion accuracy is weaker than the official-source path
- final fallback counts must be documented with that caveat

Observed result:

- current fallback dry-run result from `2026-04-08`:
  - `rawRows`: `23,476`
  - `uniqueStores`: `19,928`
  - `includedStores`: `13,532`
  - `excludedStores`: `6,396`
- this count is intentionally conservative and excludes `5,093` low-confidence Overture rows that lacked an official Starbucks `store-locator/store/<id>` URL anchor

## 2026-04-08: Treat `ownershipTypeCode` as the strongest first-pass filter

Decision:

- Treat `ownershipTypeCode === "CO"` as company-operated candidate stores.
- Treat `ownershipTypeCode !== "CO"` as excluded licensed stores.

Why:

- This was the strongest consistent ownership signal observed in live responses.
- Licensed environments such as Target, Safeway, QFC, airport, hospital, and university locations consistently appeared as `LS`.

## 2026-04-08: Add conservative environment heuristics for company-operated false positives

Decision:

- Add a second-pass exclusion layer for company-operated stores that still look like hotels, secure-access hospitals, pickup-only small formats, office-lobby stores, or other clearly low-likelihood restroom-keypad candidates.

Why:

- Live responses proved that `CO` is necessary but not sufficient.
- Verified `CO` examples included:
  - `Copley Marriott`
  - `Pickup - U Village North`
  - `Secure Access SCH River-Floor`
  - office-building embedded downtown stores

Tradeoff:

- This is intentionally conservative and may exclude some legitimate public stores.
- That is preferable to flooding the map with clearly implausible restroom-code venues.

## 2026-04-08: Use official Starbucks colors as reference, but ship a custom token system

Decision:

- Use verified Starbucks color roles as inspiration and provenance.
- Ship distinct app tokens rather than cloning the exact official palette everywhere.

Why:

- The product is not affiliated with Starbucks.
- A custom token layer reduces brand-confusion risk while preserving the desired feel.

## 2026-04-08: Do not ship Starbucks proprietary fonts

Decision:

- Use `Geist`, `Fraunces`, and `IBM Plex Sans Condensed` via `next/font`.

Why:

- Starbucks documents `SoDo Sans`, `Lander`, and `Pike` publicly, but those are not open-source web fonts.
- The project requirements explicitly forbid downloading or embedding proprietary font files.

## 2026-04-08: Use the attached custom logo everywhere

Decision:

- Replace Starbucks branding in the implementation with the attached custom logo.

Why:

- Product requirement
- necessary to avoid trademark confusion

## 2026-04-08: Keep all writes server-mediated

Decision:

- Anonymous clients will never write directly to sensitive Supabase tables.
- All inserts and vote mutations will be routed through server handlers or server-only database functions.

Why:

- Product requirement
- avoids exposing the service role key
- allows rate limiting, normalization, validation, and privacy controls in one place

## 2026-04-08: Persist only hashed/HMAC’d device identifiers

Decision:

- The client may hold a local random device UUID.
- The server will hash or HMAC it before persistence.
- The raw device ID and its stored hash will never be returned to the browser.

Why:

- Product requirement
- keeps anonymous anti-abuse controls without exposing device identifiers

## 2026-04-08: Add a dev-only local mock backend when Supabase is absent

Decision:

- When local development starts without Supabase credentials, fall back to a seeded in-memory backend for stores, codes, and votes.
- Keep that fallback disabled in production unless `STARBUCKS_PITSTOP_LOCAL_MOCK=1` is set explicitly for local preview use.

Why:

- The repository should be runnable on a fresh machine without blocking on external credentials.
- Fake client-side writes or browser-only mocks would violate the requirement to keep writes server-mediated.
- A server-only mock path preserves the request contract while keeping local onboarding fast.

Tradeoff:

- The fallback is intentionally ephemeral and only representative, not authoritative.
- Real Supabase-backed QA is still required before deployment or signoff.

## 2026-04-08: Document the official creative-site certificate issue

Decision:

- Record that `creative.starbucks.com` presented an expired TLS certificate during shell-based research.

Why:

- This affects provenance and repeatability.
- The content is still on an official Starbucks domain, but the certificate issue should not be hidden.

## 2026-04-09: Move radius queries to a PostGIS-backed RPC

Decision:

- Replace the bbox-fetch-then-filter-in-memory radius query pattern with a server-side `nearby_stores` RPC that uses `ST_DWithin` and `ST_Distance`.

Why:

- The previous approach applied `.limit()` before ordering, then filtered and sorted an arbitrary subset in memory.
- In dense metros, this could hide nearby stores or produce inconsistent results.
- The `stores` table already has a PostGIS `geog` column with a GIST index.

Tradeoff:

- Requires applying the new migration `20260410164503_nearby_and_search_rpcs.sql`.

## 2026-04-09: Move search to a parameterized RPC

Decision:

- Replace raw user-input interpolation into PostgREST `.or()` expressions with a server-side `search_stores_by_text` RPC.

Why:

- User input containing commas, parentheses, or other PostgREST operator-significant characters could break the filter or alter its meaning.
- Real-world searches like `Seattle, WA` or `Starbucks (Downtown)` are exactly the inputs that would fail.

## 2026-04-09: Cluster against viewport bounds, not world bounds

Decision:

- Compute approximate viewport bounds from latitude, longitude, and zoom level (with a 1.5x buffer) and pass those to `supercluster.getClusters()` instead of hardcoded world bounds.

Why:

- With ~13.5k synced stores, clustering the entire world dataset at high zoom levels caused unnecessary computation and could degrade map interaction quality.

## 2026-04-10: Post-live-verification hardening pass

Decision:

- During and after the first live Supabase + Vercel-preview verification, six classes of architectural correction were applied. They are captured in full (root cause, fix, verification) in `docs/BUG_FIX_LOG.md`. The durable decisions are summarized here so this log remains the authoritative index of architectural choices.

Corrections:

- **`#variable_conflict use_column` for `RETURNS TABLE` PL/pgSQL functions.** `submit_code_report`, `recompute_store_code_scores`, and `vote_on_code` declared output columns whose names collided with the real `codes` table columns (`store_id`, `is_active`, etc.), causing `42702` ambiguous references inside `ON CONFLICT` and bare `UPDATE` targets. The project convention going forward is to add `#variable_conflict use_column` at the top of any PL/pgSQL function whose `RETURNS TABLE` signature shares column names with the tables it writes. Applied via `20260410170000_fix_rpc_variable_conflicts.sql`.
- **DB rate-limit fallback must be indexed.** `enforceRateLimit` falls back to Supabase `COUNT(*)` scoped to `(hashed_identity, created_at)` when Upstash is not configured. This path must have supporting composite indexes so writes never turn into sequential scans. Applied via `20260410180000_rate_limit_fallback_indexes.sql`, verified with `EXPLAIN` (`Index Only Scan` on both). Upstash is still preferred for distributed correctness but the fallback is now safe.
- **Deterministic ordering in `search_stores_by_text`.** The UI auto-selects `results[0]` on search, so the RPC must produce a stable ordering. Rank is `CASE`-based (exact city/zip/name first, then prefix, then substring) with a `(name, id)` tiebreaker. Applied via `20260410180500_search_stores_deterministic_order.sql`.
- **Excluded stores must not render via `/location/[id]`.** The list APIs filtered `is_excluded = false` but `fetchStoreById` did not, so any guessable excluded store ID still rendered a public detail page. The rule is now "every read path that resolves a single store must filter `is_excluded = false`." Fixed in `src/lib/store-data.ts`.
- **Schema-level sanitization is the single source of truth for search input.** The original split — schema validates raw length, `searchStores` strips wildcards — allowed inputs like `"__"` or `"%%"` to pass validation and become `ILIKE '%%'` (full table scan). The rule is now "any invariant a downstream callee relies on lives in the Zod schema, not in the callee." Applied via `.transform(sanitizeSearchQuery) + .refine(≥2 alnum)` in `searchQuerySchema`.
- **Shared API error helper owns the HTTP response contract.** `apiErrorResponse` in `src/lib/api-errors.ts` is the single place that maps thrown errors to HTTP responses: `ZodError` → 400 with per-field details, `ApiClientError` → explicit 4xx, `SyntaxError` → 400 `"Invalid JSON in request body."`, anything else → 500 generic (with the real error logged server-side, never echoed to the client). Route handlers must not build ad-hoc error responses in their catch blocks.
- **`@next/env` `loadEnvConfig` in operator scripts.** `scripts/sync-stores.ts` must not read `process.env` without first calling `loadEnvConfig(process.cwd(), …)`, so `npm run sync-stores` works from a fresh shell without manual `source .env.local`. Any future operator-facing script that reads Supabase env should follow the same pattern.

Why:

- Every item above was surfaced either in live smoke (a failing submit revealed the ambiguous column bug; a 401 revealed the SSO protection flow) or in post-hoc review (degenerate search input; 500-on-bad-JSON; rate-limit table scans). The cost of letting any one of them ship was meaningfully higher than the cost of fixing in-place.

Tradeoff:

- Six additional migrations now sit on top of `20260409070148_initial_schema.sql`. They are each small and idempotent, but operators applying the project fresh have more SQL to run. `supabase db push` handles ordering automatically.

## 2026-04-10: Release coordinator — ship on Supabase-backed rate-limit fallback, provision Upstash before scale

Decision:

- Ship the release candidate with the Supabase-backed rate-limit fallback active (no Upstash in prod env).
- Provision Upstash (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`) as a follow-up before any traffic-scale event.

Why:

- The Supabase fallback is durable across serverless invocations (state lives in the `codes` / `votes` tables, not in per-instance memory), so it is a working rate limiter, not an effectively disabled one.
- The fallback path is already indexed via `20260410180000_rate_limit_fallback_indexes.sql`, verified with `EXPLAIN` as `Index Only Scan` on both `codes` and `votes`.
- The DB unique constraints on `(store_id, code_normalized)` and `(code_id, voter_hash)` bound the race window when two concurrent requests both pass the count check before either commits.
- Provisioning Upstash is a config-only change — no code-path change, no redeploy-blocking work.

Tradeoff:

- Each rate-limited mutation adds an extra Supabase query relative to the Upstash path.
- Under a concurrent burst from the same hashed device, two simultaneous requests can both read count < limit; the DB-level unique constraints catch the meaningful duplicates, but the soft cap is slightly leaky.

Follow-up:

- Provision Upstash Redis before any public-scale event. Set the two env vars in Vercel prod + preview. No code change required — `getRatelimit()` already gates on `hasUpstashEnv()`.

## 2026-04-10: Release coordinator — canonical production URL is `starbucks-pitstop.vercel.app`

Decision:

- Treat `https://starbucks-pitstop.vercel.app/` as the canonical production URL for the release-candidate launch.
- Remove the existing 307 redirect to `stopatstarbucks.vercel.app` via the Vercel dashboard. Both domains are attached as aliases on Vercel's currently-promoted production deployment (verified on 2026-04-10 against `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb`, SHA `745540a`; subsequent doc-only commits reuse the same alias configuration), but the canonical domain is configured at the dashboard level to redirect to the other alias. That dashboard-level redirect is what needs removing.

Why:

- The redirect is not in the repo code — verified: no `vercel.json`, no `redirects()` in `next.config.ts`, no middleware redirect reference, and `grep -r stopatstarbucks` returns zero hits in tracked source outside `docs/research/prod-env-summary.md` and this decisions log. The redirect is a Vercel dashboard-level domain setting only.
- The Definition of Done in the release execution board explicitly requires Wave 2 to run against the canonical production URL. Running it against the redirect target instead would be technically equivalent (same deployment served from both aliases) but would leave the repo's own release criteria unmet.

Historical note (corrected 2026-04-10):

- An earlier version of this decision entry stated that `stopatstarbucks.vercel.app` was "not an alias of this project" and "not visible under either of the repo owner's two Vercel teams." That investigation ran against the then-stale production deployment `dpl_HR26YJGEBk3xGTpE6fJx9W36sFs8` (initial commit) before the release commits were pushed. On 2026-04-10, after the release commits shipped, the active production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`) was observed to have BOTH `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` in its `alias` list — confirmed via `get_deployment`. Subsequent doc-only commits reuse the same alias configuration. The earlier "ownership mystery" was an artifact of reading stale deployment metadata. The dashboard-level redirect, however, is real and persists independently of alias attachment.

Recheck (2026-04-10 20:28 MST):

- `curl -I https://starbucks-pitstop.vercel.app/` still returned `HTTP/2 307` with `location: https://stopatstarbucks.vercel.app/`, while `curl -I https://stopatstarbucks.vercel.app/` returned `HTTP/2 200`.
- `vercel inspect https://starbucks-pitstop.vercel.app` and `vercel alias ls` both showed the current production deployment as `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`, with both `vercel.app` hostnames attached as aliases.
- Conclusion unchanged: the redirect still lives in Vercel's domain settings, not in repo code or deployment alias state.

Follow-up:

- Completed 2026-04-10 20:35 MST: the dashboard-level redirect was removed and `curl -sI https://starbucks-pitstop.vercel.app/` now returns `HTTP/2 200`. Wave 2 proceeded on the canonical host.

## 2026-04-10: Release coordinator — Wave 2 passed on the canonical production URL

Decision:

- Mark the app production-ready for the current release after canonical-host verification completed on `https://starbucks-pitstop.vercel.app/`.

Why:

- The only active operational blocker was the Vercel dashboard redirect on the canonical host. That redirect was removed, and the canonical URL now serves the production deployment directly.
- Runbook smoke checks 1–6 passed on the canonical host.
- Browser verification succeeded on the canonical host at 375 / 768 / 1024 / 1440 widths with zero console errors, and the search/detail flow rendered correctly.
- Lighthouse on the canonical host improved from 42 on the first pass to 81 on the warmed pass, with Accessibility 100 / Best Practices 96 / SEO 100 on both runs.

Tradeoff:

- A literal physical-device field check for geolocation/touch behavior is still worth doing, but the release gate is satisfied by the existing automated coverage plus live browser verification on the canonical host.
- A few post-launch hardening items still remain, but they are not launch blockers for the current release.

Follow-up:

- Record the canonical-host verification in `docs/research/verification-summary.md`, `docs/QA.md`, and `docs/BUILD_STATUS.md`.
- Treat remaining hardening items as post-launch follow-ups, not launch gates.

## 2026-04-11: Mapbox public token URL allowlist is explicit, not wildcarded

Decision:

- Restrict `NEXT_PUBLIC_MAPBOX_TOKEN` (Mapbox token id `cmnr5hlhd00jh2vpoopc6k7t5`, account `three-olives`) to an **explicit, enumerated** list of origins via the Mapbox Tokens API rather than a wildcard like `https://starbucks-pitstop-*-williamjake.vercel.app/*`.
- The allowlist is the two canonical hosts (`starbucks-pitstop.vercel.app`, `stopatstarbucks.vercel.app`), every existing numbered Vercel deployment URL under `starbucks-pitstop-<hash>-williamjake.vercel.app`, and `http://localhost:3000` for dev.

Why:

- Mapbox URL restrictions, as exercised against the live API, do not honor a `*` subdomain wildcard the way the original plan assumed; the working configuration is a literal list. Confirmed empirically by Probe 5 (an unlisted `*-williamjake.vercel.app` host got `403`).
- An explicit allowlist is also a stricter abuse model: a leaked token cannot be used from a freshly-spun preview URL on the same Vercel team without being added.
- `127.0.0.1` was deliberately omitted because Mapbox URL restrictions reject IP literals; `http://localhost:3000` covers the dev case (and matches what `next dev` actually serves on, even though `next.config.ts:5` lists `127.0.0.1` in `allowedDevOrigins`).
- Including `localhost` (rather than restricting to production hosts only) was chosen so that local dev keeps working without juggling a second token. The cost is negligible because `localhost` Referers can only originate from a developer's own machine.

Tradeoff:

- New preview deployments will return `403` from Mapbox until their URL is appended manually. Acceptable today because preview-deploy churn is low; if it becomes painful, the next move is either a CI step that PATCHes the allowlist on every `vercel deploy`, or a separate preview-only token with its own scopes.
- The token is now functionally browser-only: Probe 3 showed Mapbox returns `403` for requests with no `Referer` header once URL restrictions are active. Any future server-side caller of this same token would need its own unrestricted token. This is fine — the token has only ever been used from `"use client"` components (`src/components/home/PitstopShell.tsx:191`, `src/components/map/StoreMap.tsx:230`).

Evidence:

- Verification probes and exact HTTP results recorded in `docs/QA.md` (Remaining Open Items, Mapbox bullet) and `docs/BUILD_STATUS.md` (2026-04-11 entry).
- Restriction `modified` timestamp returned by the Mapbox Tokens API: `2026-04-12T01:03:29.333Z`.

## 2026-04-12: Release coordinator — remove redundant SECURITY DEFINER usage from views and write RPCs

Decision:

- Apply `20260412010000_security_invoker_and_search_path_hardening.sql`.
- Switch `public_store_read_model` and `public_code_read_model` to `security_invoker = true`, revoke anon/authenticated access on the view surface, and retain explicit `SELECT` for `service_role`.
- Rewrite `submit_code_report`, `recompute_store_code_scores`, and `vote_on_code` as `SECURITY INVOKER`.
- Pin `search_path = public, pg_temp` on `submit_code_report`, `recompute_store_code_scores`, `vote_on_code`, `wilson_score`, `nearby_stores`, `search_stores_by_text`, and `set_updated_at`.

Why:

- Current app reads are server-mediated through `createServiceRoleClient()` and not through a browser-side anon client. In the checked-in code, read-model access lives in `src/lib/store-data.ts`, called from server paths like `src/app/api/search/route.ts` and `src/app/location/[id]/page.tsx`.
- With that Path 1 assumption confirmed, the read-model views do not need creator-privilege semantics. `security_invoker = true` removes unnecessary RLS bypass from the view layer without changing the app's runtime behavior.
- The write RPCs are only invoked from API routes via the service-role client. Because service role already bypasses RLS, `SECURITY DEFINER` was redundant privilege elevation.
- Pinning `search_path = public, pg_temp` addresses the mutable-`search_path` warning surface without changing the function contracts.

Verification:

- `npm run test` remained green at **80 tests across 9 files**.
- Canonical-host runtime verification passed after apply:
  - GET checks 1-6 from `docs/RELEASE_RUNBOOK.md` still returned the expected `200` / `400` results.
  - Live code submit returned `200`.
  - Live vote returned `200`.
  - Duplicate vote still returned `409` with `"You have already voted on this code."`
- The temporary production verification artifact was cleaned up immediately afterward by deleting the vote row first and then the submitted code row (`3a6c7420-de20-4aba-986d-1f3ae4a7cf14`), leaving no test data in prod.
- A follow-up `supabase db lint --linked` attempt hit `cli_login_postgres` auth failure, so the closeout is based on successful runtime verification rather than advisor CLI output.

## Pending

- exact sync tiling implementation
- exact exclusion token list after the first full U.S. sync run
- measured runtime of the final fallback export + upsert pass
