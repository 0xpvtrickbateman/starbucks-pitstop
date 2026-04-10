# Production Environment Summary
Generated: 2026-04-10 (Wave-2 gate report)

---

## 1. Production URL

| Item | Value |
|---|---|
| Vercel project | starbucks-pitstop (`prj_b4or0ZfjjtJsDPUeaCMpEVGzxECy`) |
| Team | Jake / williamjake (`team_oOzB9Jge7vLhtECqXtPwsvuW`) |
| Prod deployment ID | `dpl_HR26YJGEBk3xGTpE6fJx9W36sFs8` (target=production) |
| Canonical Vercel domain | https://starbucks-pitstop.vercel.app/ |
| Effective live URL | **https://stopatstarbucks.vercel.app/** |
| Custom domain | None configured |
| Vercel `live` flag | `false` (project API field) |

**Redirect chain observed (curl):**
```
https://starbucks-pitstop.vercel.app/  →  HTTP 307  →  https://stopatstarbucks.vercel.app/  →  HTTP 200
```

`stopatstarbucks.vercel.app` returns HTTP 200 with `x-nextjs-prerender: 1` and `strict-transport-security` header present. HTTPS is active via Vercel's shared TLS (Let's Encrypt / Vercel CA). No custom domain, so no separate cert to verify.

The two newer deployments (`dpl_Hm3g7271...` and `dpl_2FaN1gb...`) have `target: null` — they are preview builds, not promoted to production.

**Assessment:** The app IS live and reachable. However:
- No custom domain has been configured — the production URL is a `*.vercel.app` preview-class domain.
- The Vercel project's `live` field is `false`, which indicates Vercel does not consider this a promoted production release.
- The effective domain (`stopatstarbucks.vercel.app`) is NOT the same project's canonical alias — this is a redirect target that belongs to a different Vercel resource or alias configuration. This warrants coordinator review.

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

| Variable | prod (Vercel) | preview (Vercel) | dev/local |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **unverified*** | **unverified*** | present |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **unverified*** | **unverified*** | present |
| `SUPABASE_SERVICE_ROLE_KEY` | **unverified*** | **unverified*** | present (.env.local only) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | **unverified*** | **unverified*** | present |
| `NEXT_PUBLIC_SITE_URL` | **unverified*** | **unverified*** | present (localhost value) |
| `RATE_LIMIT_SECRET` | **unverified*** | **unverified*** | present (.env.local), absent (.env) |
| `UPSTASH_REDIS_REST_URL` | **unverified*** | **unverified*** | **absent** (blank in both .env files) |
| `UPSTASH_REDIS_REST_TOKEN` | **unverified*** | **unverified*** | **absent** (blank in both .env files) |
| `OVERTURE_RELEASE` | **unverified*** | **unverified*** | present |
| `STARBUCKS_PITSTOP_LOCAL_MOCK` | **unverified*** | **unverified*** | present (=0 in .env.local) |

\* The Vercel MCP tools do not expose an env-var listing endpoint, and the Vercel CLI is not authenticated locally. Vercel env var presence in prod/preview could not be directly confirmed. The prod build completed successfully (`Compiled successfully in 5.5s`), but the app uses optional env var schemas (`optionalString()` / `optionalUrl()`) so a missing secret would not cause a build failure — it would silently fall back to mock/degraded mode. **Direct Vercel dashboard verification is required.**

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

The app's `config.ts` has `hasUpstashEnv()` which gates rate limiting. The `@upstash/ratelimit` and `@upstash/redis` packages are present in `package.json`. If Upstash is not provisioned in prod, the app will silently fall back (the env vars are `optional` in the Zod schema) — rate limiting will be inactive.

**This is a coordinator decision item.** The deployment agent cannot confirm whether Upstash is provisioned in prod Vercel env vars. The coordinator must decide:
1. Whether to accept launch without Upstash rate limiting active.
2. Whether to block Wave 2 until Vercel prod env vars are confirmed to include Upstash credentials.

---

## Summary Paragraph

**Production URL:** https://stopatstarbucks.vercel.app/ (HTTP 200, HTTPS active via Vercel shared TLS, HSTS present). Reached via HTTP 307 redirect from https://starbucks-pitstop.vercel.app/. No custom domain. The Vercel project `live` flag is `false` and there is no vercel.json in the repo. The effective live domain (`stopatstarbucks.vercel.app`) appears to be a redirect alias not owned by this project — this is unusual and should be confirmed.

**SSL:** Active on all *.vercel.app domains. No custom domain cert to verify.

**Env parity:** Cannot be confirmed directly — Vercel env var API not accessible without CLI auth. Local dev has Supabase + Mapbox secrets present; Upstash absent in all local files. Prod env var state is unknown without dashboard inspection.

**Upstash:** Not provisioned locally. Prod status unverified. Coordinator decision required — do not assume active.

**Supabase:** Dedicated prod project (`ipjqdcuqykbrhsjwfjoh`) is ACTIVE_HEALTHY. RLS is enabled on all sensitive tables but NO policies are defined — functionally deny-all for direct anon access, but two SECURITY DEFINER views bypass this. Multiple security advisories present.

**Blockers:** See BLOCKERS section below.

---

## BLOCKERS

### BLOCKER 1 — Vercel prod env vars unverified (HIGH)
The Vercel CLI is not authenticated locally and no env-var listing MCP tool is available. It is unknown whether `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_MAPBOX_TOKEN`, and `RATE_LIMIT_SECRET` are set in Vercel's prod environment. The app's optional env schema means a missing secret causes silent fallback to mock mode, not a build failure. **Wave 2 production verification cannot be trusted until Vercel dashboard confirms all five required secrets are present in the production environment.**

### ACCEPTED — Upstash deferred to post-launch follow-up (release coordinator, 2026-04-10)
Rate limiting runs on the **indexed Supabase fallback** — durable across serverless invocations, backed by composite indexes via migration `20260410180000_rate_limit_fallback_indexes.sql`, bounded by DB unique constraints on `(store_id, code_normalized)` and `(code_id, voter_hash)`. See `docs/DECISIONS.md` 2026-04-10 "Release coordinator — ship on Supabase-backed rate-limit fallback" entry. Upstash provisioning is a pre-scale follow-up, **not a release gate**.

### RESOLVED — Canonical production URL (release coordinator, 2026-04-10)
Canonical production URL for this release: **`https://starbucks-pitstop.vercel.app/`**.

Post-investigation by the coordinator:

- `stopatstarbucks.vercel.app` is **not** in `dpl_HR26YJGEBk3xGTpE6fJx9W36sFs8` alias list, not in project `prj_b4or0ZfjjtJsDPUeaCMpEVGzxECy` domains, not in either of Jake's Vercel teams (`williamjake`, `pvtrick_bateman`), and returns 404 for `get_deployment` in both.
- The repo contains **no code-level redirect source**: no `vercel.json`, no `redirects()` in `next.config.ts`, no middleware redirect, and `grep -r stopatstarbucks` returns zero hits outside this summary file.
- Conclusion: the 307 from `starbucks-pitstop.vercel.app` → `stopatstarbucks.vercel.app` is a **Vercel dashboard-level domain setting** outside repo control.

**User action required before Wave 2:** remove the dashboard-level redirect so `starbucks-pitstop.vercel.app` stops returning 307.

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
