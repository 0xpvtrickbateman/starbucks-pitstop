# Starbucks Pitstop — Release Runbook

> **Maintenance notice:** This runbook must be updated whenever deploy tooling, hosting, or critical API paths change. Last updated: 2026-04-10.

---

## Table of Contents

1. [Deploy Procedure](#1-deploy-procedure)
2. [Post-Deploy Smoke Checks](#2-post-deploy-smoke-checks)
3. [Rollback Procedure](#3-rollback-procedure)
4. [First-Response Playbook](#4-first-response-playbook)
5. [Runbook Maintenance](#5-runbook-maintenance)

---

## 1. Deploy Procedure

### Release branch

`main` is the release branch. All production deploys originate from `main`. No feature branches are promoted directly to production.

### Prerequisites

Before triggering a deploy, confirm the following local gates are green on the release commit:

```bash
npm run lint          # ESLint — must exit 0
npx tsc --noEmit     # TypeScript type check — must exit 0
npm run test         # Vitest — must report 80 tests across 9 files passing
npm run build        # Next.js production build — must exit 0
```

The build command is `npm run build` (runs `next build`, Next.js 16.2.3). No custom `vercel.json` or special build flags are used — the project relies on Vercel's autodetected Next.js settings.

### Database migrations

All Supabase migrations must be applied to the production database **before** the app deploy goes live. Apply them in filename order:

```bash
supabase db push --linked
```

Migrations in `supabase/migrations/`:

| File | Purpose |
|---|---|
| `20260409070148_initial_schema.sql` | Core schema — stores, codes, votes, RLS |
| `20260409073115_expand_stores_for_scraper.sql` | Expand stores table for scraper fields |
| `20260409073142_fix_view_address_alias.sql` | Fix address alias in view |
| `20260410164503_nearby_and_search_rpcs.sql` | `nearby_stores` and `search_stores_by_text` RPCs |
| `20260410170000_fix_rpc_variable_conflicts.sql` | `#variable_conflict use_column` fix in PL/pgSQL functions |
| `20260410180000_rate_limit_fallback_indexes.sql` | Composite indexes for DB rate-limit fallback |
| `20260410180500_search_stores_deterministic_order.sql` | Deterministic ordering in search RPC |

### Environment variables

Production environment variables must be set in the Vercel project dashboard before the deploy. For the full presence matrix, see `docs/research/prod-env-summary.md`.

Variables consumed by the app (from `src/lib/config.ts`):

**Public (exposed to browser bundle):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox GL access token

**Server-only (never exposed to the client):**
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (write operations). **Never expose to browser bundles.**
- `RATE_LIMIT_SECRET` — HMAC secret for device ID hashing (min 16 chars)
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL (rate limiting; falls back to DB if absent)
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token
- `OVERTURE_RELEASE` — Overture Maps release tag used by the sync script (not required at runtime)
- `STARBUCKS_PITSTOP_LOCAL_MOCK` — Set `"1"` to enable in-memory mock backend. **Must be absent or `"0"` in production.**

### Deploy trigger (Vercel Git integration)

Deployment is triggered automatically by Vercel's Git integration when a commit lands on `main`. No manual CLI push is required in the standard path.

**Standard path:**

1. Merge the release PR into `main` on GitHub.
2. Vercel detects the push and queues a production deployment automatically.
3. Monitor the build in the Vercel dashboard: https://vercel.com/williamjake/starbucks-pitstop

**Manual CLI path (if Git integration is unavailable):**

```bash
vercel --prod
```

This deploys the current working tree. Run from the repo root. Requires `vercel` CLI authenticated to the project.

### Confirming deployment succeeded

1. **Vercel dashboard:** The deployment status must show **Ready** (green). Note the assigned production URL.
2. **DNS propagation:** If using a custom domain, confirm the domain resolves to the new deployment:
   ```bash
   curl -sI https://starbucks-pitstop.vercel.app/
   # Expect: HTTP/2 200
   ```
3. **Build routes present:** The build produces these routes — confirm none are missing from the Vercel Functions tab:
   - `/` (static shell)
   - `/_not-found`
   - `/api/codes`
   - `/api/locations`
   - `/api/search`
   - `/api/votes`
   - `/location/[id]`
   - `/manifest.webmanifest`

---

## 2. Post-Deploy Smoke Checks

Run these checks immediately after the deployment shows **Ready** in the Vercel dashboard. Replace `PROD_URL` with the confirmed production URL.

```bash
export PROD_URL="starbucks-pitstop.vercel.app"
```

### Smoke checklist

| # | Check | Command | Expected |
|---|---|---|---|
| 1 | Home page returns 200 | `curl -sI https://$PROD_URL/` | `HTTP/2 200` |
| 2 | Locations — bbox query | `curl -s "https://$PROD_URL/api/locations?bbox=-122.5,47.4,-122.2,47.7"` | `200`, JSON body with `stores` array and `meta.source` = `"supabase"` |
| 3 | Locations — radius query | `curl -s "https://$PROD_URL/api/locations?lat=47.6062&lng=-122.3321&radius=5"` | `200`, JSON body with `stores` array (radius is in miles; validator caps it at 100) |
| 4 | Search | `curl -s "https://$PROD_URL/api/search?q=pike"` | `200`, JSON body with `stores` array |
| 5 | Search — safety input | `curl -s "https://$PROD_URL/api/search?q=a"` | `400` (query too short — schema enforces ≥2 alnum chars) |
| 6 | Manifest | `curl -sI "https://$PROD_URL/manifest.webmanifest"` | `200` |

**Check 1 — expanded:**

```bash
curl -sI "https://$PROD_URL/"
# Expect: HTTP/2 200
# Expect: content-type: text/html
```

**Check 2 — bbox (Seattle area):**

```bash
curl -s "https://$PROD_URL/api/locations?bbox=-122.5,47.4,-122.2,47.7" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('count:', d['meta']['count'], 'source:', d['meta']['source'])"
# Expect: count: <N> source: supabase
# Fail signal: source: mock-local  (means STARBUCKS_PITSTOP_LOCAL_MOCK is set in prod — must fix)
```

**Check 3 — search:**

```bash
curl -s "https://$PROD_URL/api/search?q=pike" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print('stores:', len(d['stores']))"
# Expect: stores: <N> (at least 1 for a query like "pike")
```

### Visual browser check

Open `https://$PROD_URL/` in a browser and confirm:

- Map tiles load (Mapbox GL renders the tile layer — not a blank canvas or the Mapbox-token-missing fallback panel)
- Search input field renders and accepts text
- Typing a store name (e.g., "Pike Place") returns results in the list
- Tapping a result opens the store detail sheet/sidebar

### Optional write smoke (POST — use with care; these are real writes)

These are live writes to the production database. Only run them if you have a test store ID available and intend to write a test code.

```bash
# POST /api/codes — submit a keypad code
curl -s -X POST "https://$PROD_URL/api/codes" \
  -H "Content-Type: application/json" \
  -d '{"storeId":"[TODO: real store ID]","code":"1234","deviceId":"00000000-0000-0000-0000-000000000001"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"
# Expect: JSON with "codes" array (may include the submitted code)
# Rate-limit hit (429) is acceptable if re-running; means the rate limit is working

# POST /api/votes — vote on a code
curl -s -X POST "https://$PROD_URL/api/votes" \
  -H "Content-Type: application/json" \
  -d '{"codeId":"[TODO: real code UUID]","voteType":"up","deviceId":"00000000-0000-0000-0000-000000000002"}' | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(d)"
# Expect: JSON with "codes" array
# 404 is acceptable if the codeId doesn't exist
```

### Smoke result: pass criteria

All of checks 1–6 must pass before the release is marked production-complete. If any GET route returns a non-200 (other than the intentional 400 on check 5), or if any route returns `source: mock-local`, stop and follow the rollback procedure.

---

## 3. Rollback Procedure

### When to roll back vs. hotfix

| Situation | Action |
|---|---|
| Critical data-write failure (POST /api/codes or /api/votes returning 5xx) | Roll back immediately; investigate offline |
| Read-only degradation (map loads, GET 500 on one route) | Hotfix if fix is < 15 min; otherwise roll back |
| Visible but non-critical UI bug | Hotfix on a follow-up deploy; no rollback needed |
| Supabase RLS change caused write rejection | Roll back app if RLS is the cause; revert Supabase migration if needed |
| Performance regression (slow, not broken) | Hotfix preferred; rollback only if user-facing impact is severe |

### Option A — Vercel dashboard (fastest, no CLI required)

1. Open the Vercel project dashboard: https://vercel.com/williamjake/starbucks-pitstop
2. Go to **Deployments**.
3. Find the last known-good deployment (the one before the current release).
4. Click **...** (three dots) → **Promote to Production**.
5. Confirm. The previous deployment becomes the active production deployment immediately.
6. Re-run smoke checks 1–4 against the production URL to confirm the previous version is live.

### Option B — Vercel CLI

```bash
# List recent deployments to find the previous stable URL
vercel ls --prod

# Roll back to a specific deployment URL
vercel rollback <previous-deployment-url>
# Example: vercel rollback https://starbucks-pitstop-abc123.vercel.app

# Or use promote if the deployment is already in the list
vercel promote <deployment-id-or-url>
```

After rolling back, re-run smoke checks 1–4 to confirm.

### Option C — Git-based hotfix revert (slower, use only if Vercel rollback is unavailable)

```bash
# Find the commit hash to revert
git log --oneline -10

# Create a revert commit (do NOT use --no-commit; let the revert commit land cleanly)
git revert <bad-commit-hash>

# Push to main — Vercel Git integration will redeploy automatically
git push origin main
```

This path is slower because it requires a full Vercel build cycle (~2–4 min). Use Vercel dashboard rollback (Option A) for fastest recovery.

### Supabase migration rollback

If a bad migration caused the issue:

1. Roll back the app first (Option A or B above) so users are not hitting a broken schema.
2. Then revert the migration in the Supabase dashboard (SQL Editor → run the inverse DDL manually).
3. There is no automated `supabase db rollback` — every migration revert must be written by hand as a new forward migration.
4. Document the revert migration in `supabase/migrations/` with a timestamp and apply via `supabase db push --linked`.

---

## 4. First-Response Playbook

This section covers the two most critical write paths: code submission (`POST /api/codes`) and voting (`POST /api/votes`).

### Triage decision tree

```
POST /api/codes or /api/votes broken in prod
    │
    ├─ Is it a 5xx (server error)?
    │       │
    │       ├─ Yes → Check Vercel runtime logs (step 1)
    │       │         Check Supabase connectivity (step 2)
    │       │         Is the fix obvious and < 15 min? → Hotfix
    │       │         Otherwise → ROLLBACK NOW, investigate offline
    │       │
    │       └─ No → Is it a 4xx (client/auth/rate-limit)?
    │                   │
    │                   ├─ 429 → Rate limit is working. Check Upstash / DB indexes (step 4).
    │                   ├─ 409 → Duplicate vote logic is working. Not a bug.
    │                   ├─ 400 → Check Zod validation schema or request body shape
    │                   └─ 401/403 → Check Supabase RLS policies (step 2)
    │
    └─ Is the error intermittent or affecting all requests?
            │
            ├─ All requests → likely Supabase connectivity or missing env var
            └─ Intermittent → likely rate limit, cold start, or Upstash flap
```

### Step 1 — Check Vercel runtime logs

**Dashboard:**
1. Open Vercel project → **Logs** tab.
2. Filter by the affected function (`/api/codes` or `/api/votes`).
3. Look for `500` status lines and expand to read the server-side error message.
   - The `apiErrorResponse` helper (`src/lib/api-errors.ts`) logs the real error server-side but returns a generic `"Internal server error"` body to the client — so the real error is always in the Vercel logs, never in the HTTP response body.

**CLI:**

```bash
vercel logs --since 30m
# Filter to a specific function:
vercel logs --since 30m | grep "/api/codes"
```

Common patterns to look for:

| Log pattern | Likely cause |
|---|---|
| `PostgrestError: ... 42702` | Ambiguous column in PL/pgSQL — check migration `20260410170000` was applied |
| `connection refused` / `fetch failed` | Supabase URL missing or project paused |
| `invalid API key` | `SUPABASE_SERVICE_ROLE_KEY` wrong or missing in Vercel env |
| `ZodError` in server log | Request schema mismatch — check client payload shape |

### Step 2 — Check Supabase connectivity and RLS

1. Open the Supabase dashboard for the production project: https://supabase.com/dashboard/project/ipjqdcuqykbrhsjwfjoh
2. **Project health:** Confirm the project is not paused (free-tier projects pause after inactivity).
3. **Table Editor → `codes` / `votes`:** Confirm rows exist (data loss would be visible here).
4. **Authentication → Policies:** Confirm RLS policies on `codes` and `votes` have not been changed.
   - All writes go through `SECURITY INVOKER` RPCs called with the service role key — RLS still should not block them because the service role bypasses RLS. If it does, a policy, grant, or RPC definition changed outside the migration path.
5. **SQL Editor — quick connectivity check:**
   ```sql
   SELECT count(*) FROM stores WHERE is_excluded = false;
   ```
   If this fails, the project has connectivity or schema issues.

### Step 3 — Check Vercel environment variables

If logs show `invalid API key` or the app appears to be falling back to mock backend (`source: mock-local` in `/api/locations` responses):

1. Vercel dashboard → Project → **Settings** → **Environment Variables**.
2. Confirm all server-only variables are set for the **Production** environment:
   - `SUPABASE_SERVICE_ROLE_KEY` — must be present and correct
   - `NEXT_PUBLIC_SUPABASE_URL` — must be present
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — must be present
   - `STARBUCKS_PITSTOP_LOCAL_MOCK` — must be absent or `"0"` in production
3. If a variable was missing, add it and **redeploy** (Vercel does not hot-reload env vars).

### Step 4 — Check rate-limit status

The rate limiter uses Upstash Redis when configured, with a fallback to a Supabase COUNT-based check.

**If Upstash is configured:**

1. Open the Upstash console: `[TODO: fill in Upstash console URL]`
2. Check the Redis instance is up and not hitting memory or request-rate limits.
3. If Upstash is down, the app falls back to the DB-backed rate limit automatically. Check Supabase logs for unexpected `codes` / `votes` query volume.

**If Upstash is not yet configured (DB fallback path):**

- DB fallback indexes are in place (`20260410180000_rate_limit_fallback_indexes.sql`).
- Under concurrent write bursts, the DB path may be slower. The Supabase Logs tab will show slow queries if this is the issue.
- Provision Upstash and set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` to move off the fallback path.

Also check `src/lib/config.ts` `RATE_LIMIT_SECRET`: if this var is missing or too short (< 16 chars), `enforceRateLimit` will fail. The Vercel runtime log will show the Zod parse error.

### Step 5 — Hotfix vs. rollback decision

| Fix time estimate | Action |
|---|---|
| < 15 minutes (e.g., a missing env var, a one-liner code fix) | Apply hotfix: fix → push to `main` → wait for Vercel redeploy → re-smoke |
| 15–60 minutes (e.g., a migration issue, a non-trivial code bug) | Roll back via Vercel dashboard (Option A in Section 3), then fix offline |
| > 60 minutes or cause is unclear | Roll back immediately, file an incident note in `docs/QA.md`, investigate offline |

---

## 5. Runbook Maintenance

This runbook is a living document. Update it whenever any of the following change:

- Deploy hosting platform or CI/CD tooling
- Vercel project name, team slug, or production domain
- Supabase project ID or production database
- Upstash instance or rate-limit configuration
- Addition or removal of API routes (currently: `/api/codes`, `/api/locations`, `/api/search`, `/api/votes`)
- Environment variable names or required values
- Migration ordering or rollback procedures

**Cross-references:**

- `docs/DECISIONS.md` — architectural and data decisions that inform triage
- `docs/BUILD_STATUS.md` — current release status and known risks
- `docs/QA.md` — verification logs and sign-off records
- `docs/research/prod-env-summary.md` — full production environment variable presence matrix (owned by deployment-env-worker)
- `docs/BUG_FIX_LOG.md` — detailed record of post-live bugs and their fixes

**Last updated:** 2026-04-10
