# Decisions Log

Last updated: 2026-04-08 MST

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

## 2026-04-08: Document the official creative-site certificate issue

Decision:

- Record that `creative.starbucks.com` presented an expired TLS certificate during shell-based research.

Why:

- This affects provenance and repeatability.
- The content is still on an official Starbucks domain, but the certificate issue should not be hidden.

## Pending

- exact sync tiling implementation
- exact exclusion token list after the first full U.S. sync run
- measured runtime of the final fallback export + upsert pass
