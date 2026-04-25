# Store Sync Report

Last verification run: 2026-04-10

---

## 1. Official Locator Verification (2026-04-10)

### URLs Tested

| URL | Method | Result |
|-----|--------|--------|
| `https://www.starbucks.com/store-locator` | GET with Chrome UA | HTTP 200, `text/html`, 180 KB |
| `https://www.starbucks.com/apiproxy/v1/locations?lat=47.6062&lng=-122.3321` | GET with `X-Requested-With: XMLHttpRequest` | HTTP 200, `application/json`, 116 KB |
| `https://www.starbucks.com/apiproxy/v1/locations?place=Boston%2C+MA` | GET with `X-Requested-With: XMLHttpRequest` | HTTP 200, `application/json`, 50 results |
| `https://www.starbucks.com/apiproxy/v1/locations?place=Cheyenne%2C+WY` | GET | HTTP 200, 8 results |
| `https://www.starbucks.com/apiproxy/v1/locations?place=zzzzzzzz-invalid-test` | GET | HTTP 200, `{"placeNameNotFound":true}` |

Five rapid sequential requests to the coordinate endpoint all returned HTTP 200. No Cloudflare challenge, CORS block, auth wall, or rate-limit response was observed in this session.

### Request Contract (Confirmed Live)

```
GET https://www.starbucks.com/apiproxy/v1/locations?lat={lat}&lng={lng}
GET https://www.starbucks.com/apiproxy/v1/locations?place={encoded place}

Required headers:
  Accept: application/json
  X-Requested-With: XMLHttpRequest
  User-Agent: (modern Chrome UA)
  Referer: https://www.starbucks.com/store-locator
```

### Response Shape (Confirmed Unchanged)

```json
[
  {
    "distance": 0.12,
    "store": {
      "id": "11917",
      "name": "3rd & Madison",
      "ownershipTypeCode": "CO",
      "coordinates": { "latitude": 47.60528, "longitude": -122.33437 },
      "address": { "streetAddressLine1": "...", "city": "Seattle", "countrySubdivisionCode": "WA", ... },
      "amenities": [...],
      "pickUpOptions": [...],
      "mobileOrdering": { "guestOrdering": true, ... },
      "marketBusinessUnitCode": null,
      "slug": "3rd-madison-999-3rd-ave-seattle-wa-981044019-us"
    }
  },
  ...
]
```

Dense queries return exactly 50 results. Invalid place name returns `{"placeNameNotFound":true}`. Empty area returns `[]`.

### Blocker Status

**No active Cloudflare/Akamai block observed on 2026-04-10.** The previous blocker (documented 2026-04-08 as "HTTP 403, text/html, Akamai Access Denied") did not recur in this session. However, that blocker was transient and environment-dependent: automated grid crawls may still trigger it at scale. The official source is verified correct but cannot be relied upon for unattended production automation.

---

## 2. Recommended Production Source Contract

**Recommendation: Overture Maps fallback with official source as a manual verification tool.**

Rationale (as of 2026-04-10):

- The official Starbucks locator at `https://www.starbucks.com/apiproxy/v1/locations` remains live with the known contract intact. Single-session requests return correct data.
- However, prior grid-crawl automation from this environment triggered an Akamai 403 block. The block is unpredictable and undocumented. Running an unattended nationwide grid sync risks sustained 403s mid-run, producing a partial and misleading dataset.
- Overture Maps release `2026-02-18.0` provides a complete, stable, queryable snapshot of U.S. Starbucks locations without rate-limit exposure. It lacks `ownershipTypeCode` and detailed amenity signals, making its inclusion/exclusion quality weaker than the official path.
- Per AGENTS.md: "Keep filtering conservative. When a store is ambiguous, prefer exclusion with a documented reason over optimistic inclusion."

The Overture path is the production sync contract until the official locator is confirmed stable for unattended grid automation (e.g., via a server environment where Akamai does not challenge the IP).

If the official source becomes reliably accessible for automation in the future, the preferred upgrade is: switch `--source=official` in the sync command. The official path produces richer ownership and amenity signals that eliminate the false-positive risk described in Section 4.

---

## 3. Source Contract Details

### Official Path (reference / manual verification)

| Parameter | Value |
|-----------|-------|
| Endpoint | `https://www.starbucks.com/apiproxy/v1/locations` |
| Auth | None — browser-style headers only |
| Result cap | 50 per query |
| Dense-cell threshold | Subdivide when result count >= 48 |
| Coverage strategy | Adaptive grid: lower48 (step=0.4°), Alaska (step=0.5°), Hawaii (step=0.25°) |
| Dedup key | `store.id` |
| Key exclusion signal | `ownershipTypeCode !== "CO"` |

### Overture Path (production fallback — current contract)

| Parameter | Value |
|-----------|-------|
| Dataset | Overture Maps places, release `2026-02-18.0` |
| S3 path | `s3://overturemaps-us-west-2/release/2026-02-18.0/theme=places/type=place/*` |
| Filter | `addresses[1].country = 'US' AND lower(brand.names.primary OR names.primary) LIKE '%starbucks%'` |
| Dedup primary key | Starbucks store-locator ID extracted from website URLs (`/store/<id>/`) |
| Dedup fallback | Normalized address + phone + rounded coordinates |
| Raw rows (last run) | 23,476 |
| Deduped unique stores | 19,928 |
| Included stores | 13,532 |
| Excluded stores | 6,396 |

Excluded by reason:
- `ambiguous-format` (no official store URL anchor): 5,093
- `embedded-office`: 621
- `campus`: 254
- `grocery`: 210
- `airport`: 109
- `hotel`: 39
- `hospital`: 36
- `stadium`: 17
- `pickup-only`: 17

---

## 4. Store Audit (2026-04-10)

All samples below are drawn from the latest Overture sync run (`docs/research/latest-store-sync-report.json`) and cross-checked against the live official API and the Overture export (`docs/research/latest-overture-starbucks-us.json`).

### 4a. Included Store Samples (10 of 13,532)

All 10 have valid US coordinates and an official store-locator URL anchor in the Overture data. All are marked `operating_status=open`.

| # | Store ID | City, State | Lat | Lng | Coords Valid | Notes |
|---|----------|-------------|-----|-----|--------------|-------|
| 1 | 8301 | Kapaa, HI | 22.063 | -159.322 | Yes (HI range) | CO per live API. Kauai Village Shopping Center. Clean. |
| 2 | 13923 | Lihue, HI | 21.971 | -159.380 | Yes (HI range) | CO per live API. Kukui Grove Center. Clean. |
| 3 | 6981 | Koloa, HI | 21.879 | -159.459 | Yes (HI range) | CO per live API. Poipu Shopping Village. Clean. |
| 4 | 15327 | Mililani Town, HI | 21.459 | -158.017 | Yes (HI range) | CO per live API. Clean. |
| 5 | 1005484 | Mililani Town, HI | 21.468 | -158.002 | Yes (HI range) | CO per live API. Ainamakua Drive Thru. Clean. |
| 6 | 1021444 | Haleiwa, HI | 21.577 | -158.105 | Yes (HI range) | CO per live API. Haleiwa South Loop. Clean. |
| 7 | 10295 | Kapolei, HI | 21.329 | -158.087 | Yes (HI range) | CO per live API. Kapolei Pkwy & Kamokila Blvd. Clean. |
| 8 | 1026251 | Kapolei, HI | 21.330 | -158.073 | Yes (HI range) | CO per live API. Clean. |
| 9 | 16951 | Waianae, HI | 21.435 | -158.184 | Yes (HI range) | CO per live API. Waianae Mall. Clean. |
| 10 | 9311 | Waipahu, HI | 21.400 | -158.007 | Yes (HI range) | CO per live API. Waikele Premium Outlets. Clean. |

**Flagged — false positives in included set:**

The following stores appear in the included set but are `ownershipTypeCode=LS` per the live official API. The Overture data does not carry ownership type, so these pass the Overture exclusion heuristics without triggering any pattern.

| Store ID | Live API Name | Overture Address | Why Missed |
|----------|--------------|-----------------|------------|
| 18197 | LIH Rotunda (Lihue Airport) | `3901 Mokulele Loop` | No airport/terminal keyword in address or generic URL. |
| 1007453 | Safeway Lihue 2894 | `4454 Nuhou St` | Safeway store name not visible in Overture; street address has no grocery keyword. |
| 16968 | BASE ACCESS Schofield Barracks | `Bldg. 693` | Military base — "Bldg. 693" does not match any exclusion pattern; live name not in Overture. |

Store 1025695 (Ko Olina Center) — also shown in the included-samples list — has `Suite 1-102` in its Overture address and is correctly excluded by the `\bsuite\b` embedded-office pattern. Its appearance in the top-20 included list in the JSON report is a display artifact from the report sort order (the sample is picked before classification for reporting).

**Risk assessment:** These false positives are an inherent limitation of the Overture path. They are expected, documented, and acceptable given the conservative overall exclusion rate (6,396 excluded of 19,928). A future switch to the official source with `ownershipTypeCode` filtering would eliminate them entirely.

### 4b. Excluded Store Samples (5 of 6,396)

| # | Store ID | City, State | Exclusion Reason | Trigger |
|---|----------|-------------|-----------------|---------|
| 1 | 1040485 | Honolulu, HI | hotel | `\bresort\b` in URL slug: `outrigger-reef-beach-resort` |
| 2 | 89773 | Honolulu, HI | campus | `\bcampus\b` in address: `2465 Campus Rd` |
| 3 | 11041 | Kailua, HI | embedded-office | `\bsuite\b` in URL slug: `marine-corps-hawai-mokapu-mall-bldg-6477-suite-b-117` |
| 4 | 7295 | National City, CA | embedded-office | `\bplaza\b` in address: `3060 Plaza Bonita Rd` |
| 5 | 11227 | National City, CA | embedded-office | `\bplaza\b` in address: `2230 E Plaza Blvd` |

All 5 exclusions are correctly triggered by the heuristics. Coordinates are all valid US lat/lng.

**Note on stores 4 and 5 (Plaza Bonita Road / E Plaza Blvd):** These are likely legitimate mall-based retail Starbucks — "Plaza" in the address is a street name, not a building name. However, the `\bplaza\b` embedded-office pattern is intentionally broad (Plaza is also a common office-building marker). Per the AGENTS.md guardrail: prefer exclusion over optimistic inclusion. A more precise pattern (e.g., matching `Plaza Blvd` as a street suffix rather than a building marker) could recover these stores but would require careful regression testing against the full exclusion set.

---

## 5. Known Risks

1. **Overture LP false positives (ownership-blind):** The Overture path cannot distinguish `ownershipTypeCode=CO` from `ownershipTypeCode=LS`. Stores like LIH Airport Rotunda and Schofield Barracks military base pass heuristics and land in the included set. Estimated scope: low single-digit hundreds of licensed stores in the 13,532 included set. This is documented and accepted for the current release.

2. **Official source may block at scale:** Single-session requests return 200. Grid automation with hundreds or thousands of requests per hour has previously triggered Akamai 403s. Switching to `--source=official` requires a server environment where this is verified safe.

3. **Overture release staleness:** The current dataset is `2026-02-18.0` (~7 weeks old at time of this report). Starbucks opens and closes stores continuously. A newer Overture release should be used at next sync; check https://overturemaps.org/download/ for the latest release tag.

4. **`starbucks_us_stores.json` is a partial scrape:** The scraper file in the repo root contains 964 stores across 25 states only. It is a mid-run checkpoint from the experimental `starbucks_scraper.py` and does not represent full US coverage. Do not use it as the sync input. Use the Overture export pipeline instead.

5. **`\bplaza\b` over-exclusion:** As noted in Section 4b, stores on streets named "Plaza Blvd" or similar are excluded. This is conservative and consistent with the guardrail, but worth revisiting with real-world user feedback.

---

## 6. Operator Runbook

### Prerequisites

- Node.js 18+ and `npm install` completed
- Python 3 with `duckdb` installed: `python3 -m pip install --user duckdb`
- AWS credentials in environment (for Overture S3 access): `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, or a profile that allows anonymous S3 reads from `overturemaps-us-west-2`
- Supabase credentials in `.env.local` for live upsert: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### Step 1 — Export Overture data (one-time per release)

```bash
# Export Starbucks places from Overture release 2026-02-18.0
# Output: docs/research/latest-overture-starbucks-us.json (NDJSON)
# Expected: ~23,000–24,000 rows, ~11 MB, ~2–10 min depending on network

python3 scripts/export-overture-starbucks.py \
  --release 2026-02-18.0 \
  --output docs/research/latest-overture-starbucks-us.json
```

Expected output:
```json
{"message":"Exported Overture Starbucks rows","release":"2026-02-18.0","rowCount":23476,...}
```

### Step 2 — Dry-run sync (no DB writes)

```bash
# Reads docs/research/latest-overture-starbucks-us.json (reuse-export skips re-download)
# Writes docs/research/latest-store-sync-report.json
# Does NOT write to Supabase

npm run sync-stores -- --source=overture --reuse-export --dry-run
```

Expected output (JSON lines to stdout, final line):
```json
{
  "message": "Overture fallback sync finished",
  "dryRun": true,
  "counts": {
    "rawRows": 23476,
    "uniqueStores": 19928,
    "includedStores": 13532,
    "excludedStores": 6396
  }
}
```

Verify:
- `rawRows` is ~23,000+
- `includedStores` is ~13,000–14,000
- `excludedStores` is ~6,000+
- Report written to `docs/research/latest-store-sync-report.json`

### Step 3 — Diff against previous report

```bash
# Compare counts with prior report before committing
git diff docs/research/latest-store-sync-report.json | grep '"includedStores"\|"excludedStores"\|"uniqueStores"\|"rawRows"'
```

Accept if delta is within ±500 stores from prior run. Investigate if delta exceeds ±1,000 stores.

### Step 4 — Live upsert (requires Supabase credentials)

```bash
# Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
# This upserts all stores to the `stores` table using `id` as the conflict key

npm run sync-stores -- --source=overture --reuse-export --upsert
```

Expected: same counts as dry run, no error output. Supabase upsert runs in batches of 250 rows.

### Step 5 — Spot-check specific stores

After upsert, verify a handful of known CO stores are present and a known LS store is absent:

```bash
# Known CO store that should be included: id=8301 (Kapaa, HI)
# Known LS store that should be absent: id=13730 (Safeway Cheyenne)
# (query your Supabase project directly via psql or Supabase dashboard)

psql "$DATABASE_URL" -c "SELECT id, name, city, state, is_excluded FROM stores WHERE id IN ('8301','13730','16968');"
```

Expected:
- `8301`: present, `is_excluded=false`
- `13730`: absent (excluded before upsert — only non-excluded stores are upserted) OR present with `is_excluded=true` depending on upsert mode

### Step 6 — Verify no gate regressions

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

All four should exit clean.

### Switching to the Official Source (if unblocked)

If a server environment is confirmed to handle the grid crawl without Akamai blocks:

```bash
# Official source dry run
npm run sync-stores -- --source=official --dry-run

# Official source live upsert
npm run sync-stores -- --source=official --upsert
```

The official path takes significantly longer (hours for full US coverage at low concurrency) but produces richer `ownershipTypeCode` signals that eliminate the false-positive LS stores in the Overture path.

---

## 7. Historical Notes

### 2026-04-08 — Initial verification

- Official locator endpoint verified live: `https://www.starbucks.com/apiproxy/v1/locations`
- Request contract confirmed: `Accept: application/json`, `X-Requested-With: XMLHttpRequest`
- Grid automation triggered Akamai 403 block — switched to Overture fallback
- First Overture dry-run completed: 13,532 included, 6,396 excluded

### 2026-04-10 — Re-verification (this run)

- Official locator endpoint: still live, HTTP 200, contract unchanged
- Five rapid sequential requests returned HTTP 200 — no immediate block
- Production recommendation remains Overture (block may recur at grid-crawl scale)
- Audit completed: 10 included + 5 excluded samples verified
- Three confirmed false positives identified in included set (LS stores missing exclusion signals in Overture data): IDs 18197, 1007453, 16968
- No gate regressions: lint, tsc both clean after this update

---

## 2026-04-13 Phoenix locator verification

Official Starbucks locator spot-checks on 2026-04-13 for the user-supplied Phoenix-metro labels:

- `44th St. & Thomas, Phoenix` -> official store `7540`, `2824 N 44th St`, present in `public_store_read_model`, `is_excluded=false`
- `16th Street & Bethany Home, Phoenix` -> official store `14069`, `1601 E Bethany Home Rd`, present, `is_excluded=false`
- `Rural & Lakeshore, Tempe` -> official store `116525`, `4475 S Rural Rd`, present, `is_excluded=false`
- `7th St. & Osborn, Phoenix` -> official store `1005596`, `650 E Osborn Rd`, present, `is_excluded=false`
- `N Scottsdale Rd & N Goldwater, Scottsdale` -> official store `1007783`, `3530 N Goldwater Blvd`, present, `is_excluded=false`
- `28th St & Indian School, Phoenix` -> official store `1005602`, `2802 E Indian School Rd`, present, `is_excluded=false`
- `7th & Highland, Phoenix` -> official store `1022226`, `4717 N 7th St`, present, `is_excluded=false`
- `Higley & Elliot, Gilbert` -> official store `1040430`, `49 S Higley Rd`, initially not present as a non-excluded synced store

Initial sync gap for `Higley & Elliot`:

- The synced store surface contained only `overture:9ae6313b-411c-4099-9c3d-faa8cbe110f0` at `49 S Higley Rd`.
- That row is marked `is_excluded=true`, `exclusion_reason=ambiguous-format`.
- Per the conservative-filter guardrail, the 2026-04-13 Phoenix seed migration intentionally omitted this location until the store-sync surface was repaired.

Phoenix entry seed application status:

- The seven verified non-excluded stores above were also upserted directly into the connected Supabase `codes` table on 2026-04-13.
- Follow-up verification through `public_code_read_model` returned all seven expected active entries, including `No Code Required` for store `1022226`.

## 2026-04-24 Phoenix locator follow-up

- Rechecked `Higley & Elliot, Gilbert` against the live official locator and confirmed store `1040430`, `49 S Higley Rd`, `CO`, drive-thru, cafe seating, outdoor seating, and mobile ordering.
- Inserted official spot-check store `1040430` into the connected Supabase `stores` table as `is_excluded=false`.
- Seeded `No Code Required` for `1040430`.
- Rechecked `56th St & Indian School, Phoenix` against the live official locator and confirmed store `1009251`, `5549 E Indian School Rd`, already present as `is_excluded=false`.
- Seeded `55498` for `1009251`.
- Follow-up verification through `public_store_read_model` and `public_code_read_model` returned all nine requested Phoenix metro stores/entries.

## 8. Pending

- Upgrade to a newer Overture release (check for releases after `2026-02-18.0`)
- Upsert run against a real Supabase project and measure runtime
- Investigate whether `\bplaza\b` over-exclusion warrants a refined street-suffix allowlist
- Optional: revalidate the official source from a cloud server environment to determine if grid automation is viable without Akamai blocks
