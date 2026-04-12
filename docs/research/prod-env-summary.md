# Production Environment Summary
Generated: 2026-04-10 20:38 MST (Wave-2 gate report; updated 2026-04-12 11:27 MST for Item B closeout)

---

## 1. Production URL

| Item | Value |
|---|---|
| Vercel project | starbucks-pitstop (`prj_b4or0ZfjjtJsDPUeaCMpEVGzxECy`) |
| Team | Jake / williamjake (`team_oOzB9Jge7vLhtECqXtPwsvuW`) |
| Release runtime first shipped | `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` on 2026-04-10 (target=production, SHA `745540a`); subsequent doc-only commits reuse the same bundle — inspect the Vercel dashboard for the currently-promoted production deployment ID |
| Canonical production URL | https://starbucks-pitstop.vercel.app/ |
| Additional alias on same deployment | https://stopatstarbucks.vercel.app/ |
| Custom domain | None configured |
| Current production deployment (rechecked 2026-04-10 20:35 MST) | `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu` (target=production, Ready); both `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` attached as aliases |

**Current canonical-host response (curl, rechecked 2026-04-10 20:35 MST):**
```
https://starbucks-pitstop.vercel.app/  →  HTTP 200
```

On 2026-04-10 smoke, `stopatstarbucks.vercel.app` returned HTTP 200 with `x-nextjs-prerender: 1` and HSTS headers sourced from the then-promoted production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`). At 20:28 MST, the canonical host still returned `307 -> stopatstarbucks.vercel.app`. The Vercel Domains configuration was then switched from `Redirect to Another Domain` to `Connect to an environment: Production`, and by 20:35 MST `curl -I https://starbucks-pitstop.vercel.app/` returned `HTTP/2 200` directly while both aliases still pointed at `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`. HTTPS is active via Vercel's shared TLS on both hostnames. No custom domain, so no separate cert to verify.

**Assessment (rechecked 2026-04-10 20:35 MST):** The release-candidate runtime first shipped on 2026-04-10 at `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`) with both aliases attached. At verification time, the current production deployment was still `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`, and both aliases still resolved to it. The canonical dashboard redirect has been removed, so the canonical domain now serves the production deployment directly. This file is now historical context; the live release result is recorded in `docs/research/verification-summary.md`.

---

## 2. SSL Status

| Domain | Protocol | HSTS |
|---|---|---|
| starbucks-pitstop.vercel.app | HTTPS (HTTP/2) | max-age=63072000; includeSubDomains; preload |
| stopatstarbucks.vercel.app | HTTPS (HTTP/2) | max-age=63072000; includeSubDomains; preload |

SSL is active. No custom domain cert to inspect.

---

## 3. Environment Variable Matrix

> Cells show presence status. No secret values are included.
> Local columns reflect `.env` + `.env.local` on the developer machine. Prod presence is proven behaviorally via the Wave-2 prep smoke on 2026-04-10 — see the per-variable Proof column. The Vercel MCP tools exposed to this session do not include an env-var listing endpoint, so dashboard-level literal verification is a separate defense-in-depth step, not a release gate.
> "build-only" = NEXT_PUBLIC_ vars baked at build time.

| Variable | prod (Vercel) | Proof of presence (2026-04-10) | dev/local |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **present** | `/api/locations?bbox=...` returns `meta.source: "supabase"` with 156 real stores | present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **present** | same probe | present |
| `SUPABASE_SERVICE_ROLE_KEY` | **present** | `/api/locations` uses `createServiceRoleClient()` → only reachable if the service-role key is set | present (`.env.local` only) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | **present** | Token literal `pk.eyJ1IjoidGhyZWUtb2xpdmVzIi...` extracted from `/_next/static/chunks/*.js` via grep of the deployed bundle | present |
| `RATE_LIMIT_SECRET` | **present** | `POST /api/votes` with all-zero UUIDs returned `404 "Code not found"` — only reachable through a successful `hashDeviceId()` HMAC call in `src/lib/crypto.ts`, which requires the secret | present (.env.local), absent (.env) |
| `UPSTASH_REDIS_REST_URL` | **absent (accepted)** | DB fallback path verified active — see Upstash section below | **absent** (blank in both .env files) |
| `UPSTASH_REDIS_REST_TOKEN` | **absent (accepted)** | Same | **absent** (blank in both .env files) |
| `NEXT_PUBLIC_SITE_URL` | unverified | Not exercised by any API smoke; runtime-optional | present (localhost value) |
| `OVERTURE_RELEASE` | n/a (script-only) | Consumed by `scripts/sync-stores.ts`, not runtime | present |
| `STARBUCKS_PITSTOP_LOCAL_MOCK` | **absent or `"0"`** | `/api/locations` returns `meta.source: "supabase"` — NOT `mock-local`, so local mock is not enabled in prod | present (=0 in .env.local) |

Env var presence was confirmed indirectly on 2026-04-10 via behavioral smoke against `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`) — the production deployment active at smoke time. Subsequent doc-only commits reuse the same runtime bundle, so the proof chain remains valid against whichever deployment Vercel currently has promoted. The Vercel MCP tools exposed to this session do not include an env-var listing endpoint, so dashboard-level literal verification still requires an authenticated browser session at https://vercel.com/williamjake/starbucks-pitstop/settings/environment-variables. The release-coordinator decision treats the behavioral proof as sufficient for the release gate; dashboard verification remains a valid defense in depth.

**Local env file notes:**
- `.env` (committed-safe file, gitignored): has Supabase URL + anon key + service role key + Mapbox token. `RATE_LIMIT_SECRET` is blank. Upstash vars are blank.
- `.env.local`: same Supabase/Mapbox values, adds a populated `RATE_LIMIT_SECRET`. Upstash vars still blank.
- No `.env.production` file exists.

---

## 4. Mapbox Token Restriction

Token prefix: `pk.eyJ1IjoidGhyZWUtb2xpdmVzIi...` (public token, user=three-olives).

URL-whitelist restriction status: **verified and active**. The public token `cmnr5hlhd00jh2vpoopc6k7t5` was restricted via the Mapbox Tokens API at `2026-04-12T01:03:29.333Z`. Allowed origins are `https://starbucks-pitstop.vercel.app`, `https://stopatstarbucks.vercel.app`, `http://localhost:3000`, and the explicit list of existing `starbucks-pitstop-<hash>-williamjake.vercel.app` preview URLs recorded in `docs/BUILD_STATUS.md`.

Verification probes against `https://api.mapbox.com/search/geocode/v6/forward?q=seattle`:

- Allowed Referers (`starbucks-pitstop.vercel.app`, `stopatstarbucks.vercel.app`, `localhost:3000`, and an explicitly listed preview URL) returned `200`.
- Disallowed Referers (`https://example.com/`, an unlisted preview-style host, and a request with **no Referer header**) returned `403 FORBIDDEN`.

Operational note: Mapbox URL restrictions are literal, not wildcarded. Each new preview deployment URL must be added explicitly if preview-map access is needed.

---

## 5. Supabase Project

| Item | Value |
|---|---|
| Project name | Starbucks-Pitstop |
| Project ref / ID | `ipjqdcuqykbrhsjwfjoh` |
| Region | us-east-1 |
| Status | ACTIVE_HEALTHY |
| DB version | PostgreSQL 17.6.1.104 |
| Created | 2026-04-09 |

**Distinct from dev?** Yes — there are 3 Supabase projects in the org. The Starbucks-Pitstop project (`ipjqdcuqykbrhsjwfjoh`) is distinct from "Keeps-app" and "Carbon Upscale". No separate dev Supabase project was found specifically for this app — the local dev environment uses the same hosted project ref (the URL in `.env.local` points to `ipjqdcuqykbrhsjwfjoh.supabase.co`). There is no local-only or branch Supabase project detected.

**RLS status on sensitive tables:**

| Table | RLS Enabled | Policies |
|---|---|---|
| `public.stores` | YES | **NONE** — RLS_ENABLED_NO_POLICY (INFO advisory) |
| `public.codes` | YES | **NONE** — RLS_ENABLED_NO_POLICY (INFO advisory) |
| `public.votes` | YES | **NONE** — RLS_ENABLED_NO_POLICY (INFO advisory) |
| `public.spatial_ref_sys` | NO | n/a — ERROR advisory: RLS_DISABLED_IN_PUBLIC |

**Current advisory posture:**

| Severity | Finding |
|---|---|
| INFO | `public.stores`, `public.codes`, `public.votes`: RLS enabled with no policies. This is the **intentional pattern** for server-mediated writes — anonymous clients get deny-all from Postgres, while mutations go through server routes using the service-role key (which bypasses RLS). Classified INFO by the Supabase linter, not ERROR. |
| ERROR | `public.spatial_ref_sys`: RLS disabled on a public-schema table. |
| RESOLVED | `20260412010000_security_invoker_and_search_path_hardening.sql` switched `public_store_read_model` / `public_code_read_model` to `security_invoker = true`, moved the write RPCs to `SECURITY INVOKER`, and pinned `search_path = public, pg_temp` on the flagged functions. Runtime verification passed after apply; the follow-up CLI advisor recheck was blocked by `cli_login_postgres` auth. |
| WARN | PostGIS extension installed in `public` schema; should be moved to a separate schema. |

**Critical implication:** RLS is on but no policies exist on `stores`, `codes`, `votes`. With Postgres deny-all semantics this means anonymous clients cannot read any of these tables directly — which is consistent with the app using server-side API routes and the service role key for writes. After `20260412010000_security_invoker_and_search_path_hardening.sql`, the read-model views no longer bypass RLS semantics through `SECURITY DEFINER`, and the write RPCs no longer carry redundant creator-privilege elevation. The remaining advisories are the intentional server-mediated deny-all posture for anon direct table access plus the standard PostGIS/system-table warnings.

---

## 6. Upstash Status

**Absent by design.** Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are blank in all local env files (`.env` and `.env.local`) and are classified as "absent (accepted)" in the prod column of the Env Variable Matrix (section 3) per the release-coordinator decision.

The app's `config.ts` has `hasUpstashEnv()` which gates the Upstash path. When Upstash env vars are absent, `getRatelimit()` returns null (`src/lib/rate-limit.ts:29-30`) and `enforceRateLimit()` falls through to a **Supabase `COUNT(*)`-based rate limiter** (`src/lib/rate-limit.ts:75-113`). It queries `codes` / `votes` filtered by `(hashed_identity, created_at >= window_start)` and enforces `count < limit`. The fallback is backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql` — `EXPLAIN` confirms `Index Only Scan` on both tables. Rate limiting is therefore **active on the DB fallback when Upstash is absent — it is not inactive.**

**Coordinator decision (2026-04-10):** Ship on the DB fallback; treat Upstash provisioning as a pre-scale follow-up, not a release gate. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry.

---

## Summary Paragraph

**Production URL:** Canonical is https://starbucks-pitstop.vercel.app/. Both it and https://stopatstarbucks.vercel.app/ are attached as aliases on Vercel's current production deployment (`dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`, rechecked 2026-04-10 20:35 MST). The release-candidate runtime (SHA `745540a`) first shipped at `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` on 2026-04-10 and has been carried forward unchanged by subsequent doc-only commits. The canonical domain now returns HTTP 200 directly after the dashboard redirect was removed, and Wave 2 verification completed successfully on the canonical URL.

**SSL:** Active on all `*.vercel.app` domains. No custom domain cert to verify.

**Env parity:** All 5 required production env vars behaviorally proven present on 2026-04-10 via Wave-2 prep smoke against the live deployment — see the Env Variable Matrix above for the per-variable proof chain. Direct Vercel dashboard verification is still a valid defense in depth but is not a release gate per the release-coordinator decision.

**Rate limiting:** Active via the Supabase DB fallback path (`src/lib/rate-limit.ts:75-113`), verified by a `POST /api/votes` probe that reached the post-HMAC, post-rate-limit "Code not found" branch. Upstash is deferred to a post-scale follow-up per `docs/DECISIONS.md` 2026-04-10 entry — **not a release gate**.

**Supabase:** Dedicated prod project (`ipjqdcuqykbrhsjwfjoh`) is ACTIVE_HEALTHY. RLS enabled on sensitive tables with no policies — the intentional server-mediated pattern (INFO advisory, not ERROR). On 2026-04-12, `public_store_read_model` and `public_code_read_model` were switched to `security_invoker = true`, the write RPCs were moved to `SECURITY INVOKER`, and the flagged utility functions had `search_path = public, pg_temp` pinned. Runtime verification passed after apply; the follow-up advisor CLI recheck was blocked by `cli_login_postgres` auth.

**Remaining release blocker:** None. Canonical-host verification is complete; remaining items are deferred follow-ups and advisories.

---

## BLOCKERS

### RESOLVED — Vercel prod env vars behaviorally proven present (release coordinator, 2026-04-10)
All 5 required production env vars — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `RATE_LIMIT_SECRET` — were behaviorally proven present on 2026-04-10 against `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`), the production deployment active at smoke time. Subsequent doc-only commits reuse the same runtime bundle, so the proof chain carries forward to whichever deployment Vercel currently has promoted. See the Env Variable Matrix for the per-variable proof chain. Direct Vercel dashboard inspection is still a valid defense in depth but is not a release gate.

### ACCEPTED — Upstash deferred to post-launch follow-up (release coordinator, 2026-04-10)
Rate limiting runs on the **indexed Supabase fallback** — durable across serverless invocations, backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql`, bounded by DB unique constraints on `(store_id, code_normalized)` and `(code_id, voter_hash)`. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry. Upstash provisioning is a pre-scale follow-up, **not a release gate**.

### RESOLVED — Canonical production URL serves the deployment directly (release coordinator, 2026-04-10)
Canonical production URL for this release: **`https://starbucks-pitstop.vercel.app/`**.

Current state (rechecked 2026-04-10 20:35 MST):

- Both `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` are attached as aliases on the current production deployment `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu` (verified 2026-04-10 20:35 MST via `vercel inspect` and `vercel alias ls`). Alias attachment was first verified on 2026-04-10 via `get_deployment` against `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`).
- The `starbucks-pitstop.vercel.app` domain is now configured as `Connect to an environment: Production`; it no longer redirects to `stopatstarbucks.vercel.app`.
- `curl -I https://starbucks-pitstop.vercel.app/` now returns `HTTP/2 200`, so Wave 2 can and did run against the canonical URL.

**Historical note (superseded):** An earlier revision of this document stated that `stopatstarbucks.vercel.app` was "not in the project" and "not visible under either of Jake's Vercel teams." That investigation was performed against the then-stale production deployment `dpl_HR26YJGEBk3xGTpE6fJx9W36sFs8` (initial commit) before the release commits were pushed. With the current deployment's alias list, the earlier "mystery" is resolved: both domains belong to the same project. The dashboard-level redirect persists independently.

**Completion note:** the dashboard redirect was removed on 2026-04-10, and the canonical-host release gate is now closed. See `docs/research/verification-summary.md` for the completed Wave 2 evidence.

### RESOLVED — Read-model views and write RPCs hardened to SECURITY INVOKER (release coordinator, 2026-04-12)

- Applied migration `20260412010000_security_invoker_and_search_path_hardening.sql`.
- `public.public_store_read_model` and `public.public_code_read_model` now run with `security_invoker = true`.
- Anon/authenticated access on the view surface was revoked; `service_role` retained explicit `SELECT`.
- `submit_code_report`, `recompute_store_code_scores`, and `vote_on_code` now run as `SECURITY INVOKER`.
- `wilson_score`, `nearby_stores`, `search_stores_by_text`, and `set_updated_at` now pin `search_path = public, pg_temp`.
- Runtime verification passed after apply on the canonical production URL, including the duplicate-vote edge case. A follow-up advisor/lint recheck was attempted, but `supabase db lint --linked` was blocked by `cli_login_postgres` auth, so the closeout is based on functional evidence rather than advisor CLI output.

**Clarification on the related RLS-no-policy advisory:** `rls_enabled_no_policy` on `public.stores`, `public.codes`, and `public.votes` remains **INFO**-level — see the severity table in section 5 above. It is the intentional server-mediated write pattern (anon clients get Postgres deny-all; all mutations go through server routes using the service-role key) and is NOT a release blocker.

### Non-blocking advisories
- PostGIS in `public` schema: WARN, low risk.
- `public.spatial_ref_sys` RLS disabled: ERROR advisory but is the standard PostGIS system-table exception; not actionable for app-owned tables.

---

## Revision History

This file was created by the deployment-env-worker during Wave 1 on 2026-04-10. The initial draft classified all 5 required production env vars as "unverified" and grouped `rls_enabled_no_policy` on `stores`/`codes`/`votes` with the SECURITY DEFINER views under a single ERROR-level BLOCKER heading. Neither of those classifications survived review.

The release coordinator has since revised the file to reflect the behavioral proof chain that emerged from Wave-2 prep smoke against the then-promoted production deployment, to date-anchor deployment references so they don't go stale on each doc-only redeploy, to split the RLS-no-policy INFO advisory away from the resolved view/RPC hardening work, and to replace the earlier Mapbox restriction placeholder with the actual verified allowlist and probe results.

On 2026-04-10 at 20:28 MST, the release coordinator rechecked the canonical host with `curl -I` plus Vercel CLI alias/deployment inspection, confirming that the redirect persisted while both aliases still pointed at `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`. On the same evening, the redirect was removed and the canonical host was re-verified at `HTTP/2 200`.
On 2026-04-12, the release coordinator applied the `SECURITY INVOKER` / `search_path` hardening migration and verified the production write path end-to-end; the temporary test code and vote were deleted immediately afterward.

This file is now superseded by `docs/research/verification-summary.md` for live release status. For the full revision trail, see `git log docs/research/prod-env-summary.md`.
