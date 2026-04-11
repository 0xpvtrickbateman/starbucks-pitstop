# Production Environment Summary
Generated: 2026-04-10 (Wave-2 gate report)

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
| Vercel `live` flag | `false` as of pre-release-push snapshot; not re-queried after the release push |

**Redirect chain observed (curl):**
```
https://starbucks-pitstop.vercel.app/  →  HTTP 307  →  https://stopatstarbucks.vercel.app/  →  HTTP 200
```

On 2026-04-10 smoke, `stopatstarbucks.vercel.app` returned HTTP 200 with `x-nextjs-prerender: 1` and HSTS headers sourced from the then-promoted production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`). `starbucks-pitstop.vercel.app` — despite also being attached as an alias on the same deployment — returned HTTP 307 to `stopatstarbucks.vercel.app` because of a Vercel dashboard-level domain redirect that intercepts before the alias reaches the deployment. HTTPS is active via Vercel's shared TLS on both hostnames. No custom domain, so no separate cert to verify. Subsequent doc-only commits (`7208d87`, `71aef3f`, `7d866a1`) have re-deployed with an identical runtime bundle; the redirect behavior is unchanged.

**Assessment (captured 2026-04-10; the release runtime has not changed through subsequent doc-only commits):** The release-candidate runtime shipped on 2026-04-10 at `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`) with both aliases attached — verified via `get_deployment`'s `alias` field at smoke time. Subsequent doc-only commits (`7208d87`, `71aef3f`, `7d866a1`) have re-deployed the identical runtime bundle to new deployment IDs; Vercel's currently-promoted production deployment serves the same runtime. Despite both aliases being attached, the canonical domain still returns HTTP 307 to the other alias; the redirect is a **Vercel dashboard-level domain setting** that is NOT in repo code (no `vercel.json`, no `redirects()` in `next.config.ts`, no middleware reference, and `grep -r stopatstarbucks` in tracked source returns only this document and `docs/DECISIONS.md`). Removing the redirect requires authenticated dashboard access via https://vercel.com/williamjake/starbucks-pitstop/settings/domains.

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

URL-whitelist restriction status: **unverified — tracked as a non-blocking advisory.** The Mapbox dashboard was not queried (no Mapbox MCP tool available). The token is a public (`pk.`) token visible in client bundles. Without URL restrictions it is usable by anyone who finds it in the page source, which is a cost/abuse concern rather than a correctness concern. This item is classified non-blocking in the advisory list at the bottom of the BLOCKERS section — recommended as a pre-scale or post-launch follow-up, **not a Wave 2 prerequisite**.

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

**Security advisories from Supabase linter:**

| Severity | Finding |
|---|---|
| INFO | `public.stores`, `public.codes`, `public.votes`: RLS enabled with no policies. This is the **intentional pattern** for server-mediated writes — anonymous clients get deny-all from Postgres, while mutations go through server routes using the service-role key (which bypasses RLS). Classified INFO by the Supabase linter, not ERROR. |
| ERROR | `public.spatial_ref_sys`: RLS disabled on a public-schema table. |
| ERROR | Views `public_store_read_model` and `public_code_read_model` use SECURITY DEFINER — they bypass RLS of the querying user. |
| WARN | Functions `wilson_score`, `nearby_stores`, `set_updated_at`, `search_stores_by_text` have mutable `search_path` (SQL injection risk surface). |
| WARN | PostGIS extension installed in `public` schema; should be moved to a separate schema. |

**Critical implication:** RLS is on but no policies exist on `stores`, `codes`, `votes`. With Postgres deny-all semantics this means anonymous clients cannot read any of these tables directly — which is consistent with the app using server-side API routes and the service role key for writes. However, the views `public_store_read_model` and `public_code_read_model` with SECURITY DEFINER bypass RLS and could expose data. This should be reviewed before production launch.

---

## 6. Upstash Status

**Absent by design.** Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are blank in all local env files (`.env` and `.env.local`) and are classified as "absent (accepted)" in the prod column of the Env Variable Matrix (section 3) per the release-coordinator decision.

The app's `config.ts` has `hasUpstashEnv()` which gates the Upstash path. When Upstash env vars are absent, `getRatelimit()` returns null (`src/lib/rate-limit.ts:29-30`) and `enforceRateLimit()` falls through to a **Supabase `COUNT(*)`-based rate limiter** (`src/lib/rate-limit.ts:75-113`). It queries `codes` / `votes` filtered by `(hashed_identity, created_at >= window_start)` and enforces `count < limit`. The fallback is backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql` — `EXPLAIN` confirms `Index Only Scan` on both tables. Rate limiting is therefore **active on the DB fallback when Upstash is absent — it is not inactive.**

**Coordinator decision (2026-04-10):** Ship on the DB fallback; treat Upstash provisioning as a pre-scale follow-up, not a release gate. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry.

---

## Summary Paragraph

**Production URL:** Canonical is https://starbucks-pitstop.vercel.app/. Both it and https://stopatstarbucks.vercel.app/ are attached as aliases on Vercel's currently-promoted production deployment. The release-candidate runtime (SHA `745540a`) first shipped at `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` on 2026-04-10 and has been carried forward unchanged by doc-only commits (`7208d87`, `71aef3f`, `7d866a1`). The canonical domain still returns HTTP 307 to the other alias because of a Vercel dashboard-level domain redirect — NOT a code-level configuration. That redirect must be removed via the Vercel dashboard before Wave 2 can run against the canonical URL.

**SSL:** Active on all `*.vercel.app` domains. No custom domain cert to verify.

**Env parity:** All 5 required production env vars behaviorally proven present on 2026-04-10 via Wave-2 prep smoke against the live deployment — see the Env Variable Matrix above for the per-variable proof chain. Direct Vercel dashboard verification is still a valid defense in depth but is not a release gate per the release-coordinator decision.

**Rate limiting:** Active via the Supabase DB fallback path (`src/lib/rate-limit.ts:75-113`), verified by a `POST /api/votes` probe that reached the post-HMAC, post-rate-limit "Code not found" branch. Upstash is deferred to a post-scale follow-up per `docs/DECISIONS.md` 2026-04-10 entry — **not a release gate**.

**Supabase:** Dedicated prod project (`ipjqdcuqykbrhsjwfjoh`) is ACTIVE_HEALTHY. RLS enabled on sensitive tables with no policies — the intentional server-mediated pattern (INFO advisory, not ERROR). Two SECURITY DEFINER views (`public_store_read_model`, `public_code_read_model`) bypass RLS and are a legitimate ERROR-level advisory worth reviewing before a public-facing launch.

**Remaining release blocker:** Removing the Vercel dashboard-level redirect on `starbucks-pitstop.vercel.app` so Wave 2 can verify against the canonical URL. All other items are resolved or accepted as deferred follow-ups.

---

## BLOCKERS

### RESOLVED — Vercel prod env vars behaviorally proven present (release coordinator, 2026-04-10)
All 5 required production env vars — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `RATE_LIMIT_SECRET` — were behaviorally proven present on 2026-04-10 against `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`), the production deployment active at smoke time. Subsequent doc-only commits reuse the same runtime bundle, so the proof chain carries forward to whichever deployment Vercel currently has promoted. See the Env Variable Matrix for the per-variable proof chain. Direct Vercel dashboard inspection is still a valid defense in depth but is not a release gate.

### ACCEPTED — Upstash deferred to post-launch follow-up (release coordinator, 2026-04-10)
Rate limiting runs on the **indexed Supabase fallback** — durable across serverless invocations, backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql`, bounded by DB unique constraints on `(store_id, code_normalized)` and `(code_id, voter_hash)`. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry. Upstash provisioning is a pre-scale follow-up, **not a release gate**.

### OPEN — Canonical production URL dashboard redirect (release coordinator, 2026-04-10)
Canonical production URL for this release: **`https://starbucks-pitstop.vercel.app/`**.

Current state (2026-04-10, post-release-push):

- Both `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` are attached as aliases on Vercel's currently-promoted production deployment. Alias attachment was verified on 2026-04-10 via `get_deployment` against `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`); subsequent doc-only commits reuse the same alias configuration.
- Despite both being aliases on the same project/deployment, `starbucks-pitstop.vercel.app` still returns HTTP 307 to `stopatstarbucks.vercel.app`. The redirect is configured at the **Vercel dashboard domain-settings level**, separately from the alias attachment.
- The repo contains no code-level redirect source: no `vercel.json`, no `redirects()` in `next.config.ts`, no middleware redirect reference, and `grep -r stopatstarbucks` in tracked source returns only this document and `docs/DECISIONS.md`.

**Historical note (superseded):** An earlier revision of this document stated that `stopatstarbucks.vercel.app` was "not in the project" and "not visible under either of Jake's Vercel teams." That investigation was performed against the then-stale production deployment `dpl_HR26YJGEBk3xGTpE6fJx9W36sFs8` (initial commit) before the release commits were pushed. With the current deployment's alias list, the earlier "mystery" is resolved: both domains belong to the same project. The dashboard-level redirect persists independently.

**User action still required before Wave 2 against the canonical URL:** open https://vercel.com/williamjake/starbucks-pitstop/settings/domains and remove the `starbucks-pitstop.vercel.app → stopatstarbucks.vercel.app` redirect rule (or reconfigure it to "serve this deployment").

### ADVISORY — SECURITY DEFINER read-model views bypass RLS (MEDIUM, not a release gate)
Supabase security linter flags two views as ERROR-level `security_definer_view`:

- `public.public_store_read_model`
- `public.public_code_read_model`

`SECURITY DEFINER` views enforce the creator's permissions rather than the querying user's, so they bypass RLS on the underlying tables. These views are the surface used by the API routes (`src/lib/store-data.ts`) to expose store and code data, and the intentional design is that each view projects only safe-to-expose columns. The recommended follow-up is to audit the view bodies' column projection and `WHERE` clauses, and to reclassify each view as `SECURITY INVOKER` if the RLS-bypass behavior is not load-bearing. Worth resolving before any public-facing scale event, but not a blocker for the release-candidate launch.

**Clarification on the related RLS-no-policy advisory:** The Supabase linter also reports `rls_enabled_no_policy` on `public.stores`, `public.codes`, and `public.votes`, but that finding is **INFO**-level — see the severity table in section 5 above. It is the intentional server-mediated write pattern (anon clients get Postgres deny-all; all mutations go through server routes using the service-role key) and is NOT a release blocker. Earlier drafts of this document grouped it with the SECURITY DEFINER views under a single BLOCKER heading; that grouping was incorrect and has been split.

### Non-blocking advisories
- Mapbox token URL restriction: unverified, follow-up needed.
- PostGIS in `public` schema: WARN, low risk.
- Function `search_path` mutable (`wilson_score`, `nearby_stores`, `set_updated_at`, `search_stores_by_text`): WARN, should be remediated post-launch.
- `public.spatial_ref_sys` RLS disabled: ERROR advisory but is the standard PostGIS system-table exception; not actionable for app-owned tables.

---

## Cross-Ownership Requests

None required from this agent's work. All findings are read-only observations.

Files touched by this agent: `docs/research/prod-env-summary.md` (created, new file).
No changes made to `next.config.ts`, `package.json`, or `supabase/config.toml` — no deployment-config changes were warranted based on findings.
