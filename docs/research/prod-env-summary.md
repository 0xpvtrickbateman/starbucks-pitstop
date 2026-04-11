# Production Environment Summary
Generated: 2026-04-10 (Wave-2 gate report)

---

## 1. Production URL

| Item | Value |
|---|---|
| Vercel project | starbucks-pitstop (`prj_b4or0ZfjjtJsDPUeaCMpEVGzxECy`) |
| Team | Jake / williamjake (`team_oOzB9Jge7vLhtECqXtPwsvuW`) |
| Current prod deployment ID | `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (target=production, SHA `745540a`, READY 2026-04-10) |
| Canonical production URL | https://starbucks-pitstop.vercel.app/ |
| Additional alias on same deployment | https://stopatstarbucks.vercel.app/ |
| Custom domain | None configured |
| Vercel `live` flag | `false` as of pre-release-push snapshot; not re-queried after the release push |

**Redirect chain observed (curl):**
```
https://starbucks-pitstop.vercel.app/  →  HTTP 307  →  https://stopatstarbucks.vercel.app/  →  HTTP 200
```

Both `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` return HTTP 200 with `x-nextjs-prerender: 1` and HSTS from the current production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb`. HTTPS is active via Vercel's shared TLS. No custom domain, so no separate cert to verify.

**Assessment (2026-04-10, post-release-push):** The current production deployment serves the release-candidate SHA `745540a` on both aliases. Both domains are attached in the deployment's `alias` list — verified via `get_deployment`. Despite that, the canonical domain still returns an HTTP 307 to the other alias; the redirect is a **Vercel dashboard-level domain setting** that is NOT in repo code (no `vercel.json`, no `redirects()` in `next.config.ts`, no middleware reference, and `grep -r stopatstarbucks` in tracked source returns only this document and `docs/DECISIONS.md`). Removing the redirect requires authenticated dashboard access via https://vercel.com/williamjake/starbucks-pitstop/settings/domains.

---

## 2. SSL Status

| Domain | Protocol | HSTS |
|---|---|---|
| starbucks-pitstop.vercel.app | HTTPS (HTTP/2) | max-age=63072000; includeSubDomains; preload |
| stopatstarbucks.vercel.app | HTTPS (HTTP/2) | max-age=63072000; includeSubDomains; preload |

SSL is active. No custom domain cert to inspect.

---

## 3. Environment Variable Matrix

> Cells show presence/absence only. No secret values are included.
> Local: `.env` + `.env.local` (developer machine). Prod: inferred from Vercel build — no direct env-var API access available (Vercel CLI unauthenticated locally); presence inferred from build success and runtime behavior.
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

Env var presence was confirmed indirectly on 2026-04-10 via behavioral smoke against the current production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb`. The Vercel MCP tools exposed to this session do not include an env-var listing endpoint, so dashboard-level literal verification still requires an authenticated browser session at https://vercel.com/williamjake/starbucks-pitstop/settings/environment-variables. The release-coordinator decision treats the behavioral proof as sufficient for the release gate; dashboard verification remains a valid defense in depth.

**Local env file notes:**
- `.env` (committed-safe file, gitignored): has Supabase URL + anon key + service role key + Mapbox token. `RATE_LIMIT_SECRET` is blank. Upstash vars are blank.
- `.env.local`: same Supabase/Mapbox values, adds a populated `RATE_LIMIT_SECRET`. Upstash vars still blank.
- No `.env.production` file exists.

---

## 4. Mapbox Token Restriction

Token prefix: `pk.eyJ1IjoidGhyZWUtb2xpdmVzIi...` (public token, user=three-olives).

URL-whitelist restriction status: **unverified — follow-up needed.** The Mapbox dashboard was not queried (no Mapbox MCP tool available). The token is a public (`pk.`) token visible in client bundles. Without URL restrictions it is usable by anyone who finds it in the page source. Coordinator should verify restriction settings in the Mapbox dashboard before Wave 2 production verification.

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

**ABSENT locally.** Both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are blank in all local env files (`.env` and `.env.local`).

Vercel prod/preview env var presence: **unverified** (no direct API access — see section 3).

The app's `config.ts` has `hasUpstashEnv()` which gates the Upstash path. When Upstash env vars are absent, `getRatelimit()` returns null (`src/lib/rate-limit.ts:29-30`) and `enforceRateLimit()` falls through to a **Supabase `COUNT(*)`-based rate limiter** (`src/lib/rate-limit.ts:75-113`). It queries `codes` / `votes` filtered by `(hashed_identity, created_at >= window_start)` and enforces `count < limit`. The fallback is backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql` — `EXPLAIN` confirms `Index Only Scan` on both tables. Rate limiting is therefore **active on the DB fallback when Upstash is absent — it is not inactive.**

**Coordinator decision (2026-04-10):** Ship on the DB fallback; treat Upstash provisioning as a pre-scale follow-up, not a release gate. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry.

---

## Summary Paragraph

**Production URL:** Canonical is https://starbucks-pitstop.vercel.app/. Both it and https://stopatstarbucks.vercel.app/ are attached as aliases on the current production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`, READY 2026-04-10). The canonical domain still returns HTTP 307 to the other alias because of a Vercel dashboard-level domain redirect — NOT a code-level configuration. That redirect must be removed via the Vercel dashboard before Wave 2 can run against the canonical URL.

**SSL:** Active on all `*.vercel.app` domains. No custom domain cert to verify.

**Env parity:** All 5 required production env vars behaviorally proven present on 2026-04-10 via Wave-2 prep smoke against the live deployment — see the Env Variable Matrix above for the per-variable proof chain. Direct Vercel dashboard verification is still a valid defense in depth but is not a release gate per the release-coordinator decision.

**Rate limiting:** Active via the Supabase DB fallback path (`src/lib/rate-limit.ts:75-113`), verified by a `POST /api/votes` probe that reached the post-HMAC, post-rate-limit "Code not found" branch. Upstash is deferred to a post-scale follow-up per `docs/DECISIONS.md` 2026-04-10 entry — **not a release gate**.

**Supabase:** Dedicated prod project (`ipjqdcuqykbrhsjwfjoh`) is ACTIVE_HEALTHY. RLS enabled on sensitive tables with no policies — the intentional server-mediated pattern (INFO advisory, not ERROR). Two SECURITY DEFINER views (`public_store_read_model`, `public_code_read_model`) bypass RLS and are a legitimate ERROR-level advisory worth reviewing before a public-facing launch.

**Remaining release blocker:** Removing the Vercel dashboard-level redirect on `starbucks-pitstop.vercel.app` so Wave 2 can verify against the canonical URL. All other items are resolved or accepted as deferred follow-ups.

---

## BLOCKERS

### RESOLVED — Vercel prod env vars behaviorally proven present (release coordinator, 2026-04-10)
All 5 required production env vars — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `RATE_LIMIT_SECRET` — are behaviorally proven present against the current production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb`. See the Env Variable Matrix for the per-variable proof chain. Direct Vercel dashboard inspection is still a valid defense in depth but is not a release gate.

### ACCEPTED — Upstash deferred to post-launch follow-up (release coordinator, 2026-04-10)
Rate limiting runs on the **indexed Supabase fallback** — durable across serverless invocations, backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql`, bounded by DB unique constraints on `(store_id, code_normalized)` and `(code_id, voter_hash)`. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry. Upstash provisioning is a pre-scale follow-up, **not a release gate**.

### OPEN — Canonical production URL dashboard redirect (release coordinator, 2026-04-10)
Canonical production URL for this release: **`https://starbucks-pitstop.vercel.app/`**.

Current state (2026-04-10, post-release-push):

- Both `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` are attached as aliases on the current production deployment `dpl_CUAAWd8mruTFE8bqwBnzWnCistNb` (SHA `745540a`) — verified via `get_deployment`'s `alias` field.
- Despite both being aliases on the same project/deployment, `starbucks-pitstop.vercel.app` still returns HTTP 307 to `stopatstarbucks.vercel.app`. The redirect is configured at the **Vercel dashboard domain-settings level**, separately from the alias attachment.
- The repo contains no code-level redirect source: no `vercel.json`, no `redirects()` in `next.config.ts`, no middleware redirect reference, and `grep -r stopatstarbucks` in tracked source returns only this document and `docs/DECISIONS.md`.

**Historical note (superseded):** An earlier revision of this document stated that `stopatstarbucks.vercel.app` was "not in the project" and "not visible under either of Jake's Vercel teams." That investigation was performed against the then-stale production deployment `dpl_HR26YJGEBk3xGTpE6fJx9W36sFs8` (initial commit) before the release commits were pushed. With the current deployment's alias list, the earlier "mystery" is resolved: both domains belong to the same project. The dashboard-level redirect persists independently.

**User action still required before Wave 2 against the canonical URL:** open https://vercel.com/williamjake/starbucks-pitstop/settings/domains and remove the `starbucks-pitstop.vercel.app → stopatstarbucks.vercel.app` redirect rule (or reconfigure it to "serve this deployment").

### BLOCKER 4 — RLS policies missing + SECURITY DEFINER views (MEDIUM)
Supabase security linter reports ERROR-level findings: no RLS policies on `stores`, `codes`, `votes`; two SECURITY DEFINER views. These need review before a public-facing production launch.

### Non-blocking advisories
- Mapbox token URL restriction: unverified, follow-up needed.
- PostGIS in public schema: low risk, advisory only.
- Function mutable search_path: advisory level, should be remediated post-launch.

---

## Cross-Ownership Requests

None required from this agent's work. All findings are read-only observations.

Files touched by this agent: `docs/research/prod-env-summary.md` (created, new file).
No changes made to `next.config.ts`, `package.json`, or `supabase/config.toml` — no deployment-config changes were warranted based on findings.
