# Store Sync Report

Last updated: 2026-04-08 MST

## Verified Source

- Official page: `https://www.starbucks.com/store-locator`
- Verified data endpoint: `https://www.starbucks.com/apiproxy/v1/locations`

## Verified Request Contract

Observed request headers:

- `Accept: application/json`
- `X-Requested-With: XMLHttpRequest`

Observed query shapes:

- `place=Seattle%2C%20WA`
- `lat=47.6062&lng=-122.3321`
- optional `features=...`

No verified public support was observed for:

- pagination cursor
- page number
- explicit `limit`
- bbox query

## Verified Response Shapes

Successful lookup:

- HTTP `200`
- JSON array of store results

Invalid place search:

- HTTP `200`
- `{"placeNameNotFound": true}`

Coordinate lookup with no nearby stores:

- HTTP `200`
- `[]`

## Verified Behaviors

- Result arrays are sorted by ascending `distance`.
- Dense place and coordinate queries are capped at `50` results.
- The coordinate endpoint has a finite search radius and is not a nationwide nearest-neighbor query.

Representative findings:

- `place=Seattle, WA` -> `50` stores
- `lat=47.6062&lng=-122.3321` -> `50` stores
- `place=Boston, MA` -> `50` stores
- `place=Cheyenne, WY` -> `8` stores
- `lat=43.5&lng=-107.5` -> `[]`
- `place=zzzzzzzzzz-invalid-test` -> `{"placeNameNotFound": true}`

Cheyenne radius test:

- downtown Cheyenne query returned `8` stores
- the same longitude about `25` miles north still returned stores
- about `30` miles north returned `0`

Interpretation:

- store sync must use overlapping geographic coverage
- dense cells must subdivide when a query returns `50`

## Official Source Blocker

After the initial verification phase, repeated requests from this environment began receiving:

- HTTP `403`
- `text/html`
- Akamai `Access Denied`

against both:

- `https://www.starbucks.com/store-locator`
- `https://www.starbucks.com/apiproxy/v1/locations`

This means:

- the official source contract was verified successfully for research
- the same source is not dependable for unattended automation from this environment
- per product requirements, sync must switch to an explicit documented fallback instead of silently continuing with an unstable primary source

## Observed Ownership and Environment Signals

### Strongest signal

- `ownershipTypeCode`
  - `CO` observed for company-operated candidates
  - `LS` observed for licensed stores

### Useful supporting signals

- `marketBusinessUnitCode`
- `amenities`
- `pickUpOptions`
- `mobileOrdering.guestOrdering`
- `acceptsNonSvcMop`
- `address.streetAddressLine2`
- `address.streetAddressLine3`
- `slug`

### Verified examples

Licensed:

- airports:
  - `HOST`
  - `AREASUSA`
- grocery / big box:
  - `TARGCO`
  - `KROGERCO`
  - `ALBERTSN`
- campus / institutional:
  - `UOFWASHI`
  - `PROVIHEA`
  - `MAR-INTL`

Company-operated but still suspicious:

- `Copley Marriott`
- `Pickup - U Village North`
- `Secure Access SCH River-Floor`
- downtown office-building locations with building/floor/suite markers

## Inclusion / Exclusion Logic

### Include-candidate

- `ownershipTypeCode === "CO"`

### Exclude immediately

- any `ownershipTypeCode !== "CO"`
- pickup-only / small-format patterns:
  - `pickup`
  - `grab & go`
- airport patterns:
  - `airport`
  - `terminal`
  - `concourse`
  - `gate`
  - `bag claim`
  - `pre-security`
- hotel patterns:
  - `hotel`
  - `marriott`
  - `sheraton`
  - `westin`
  - `hyatt`
  - `hilton`
  - `resort`
- healthcare / secure patterns:
  - `hospital`
  - `medical`
  - `clinic`
  - `health`
  - `secure access`
  - `patient`
  - `lobby`
- campus patterns:
  - `campus`
  - `college`
  - `student center`
  - `library`
  - `university of`
  - `univ.`
- stadium / event patterns:
  - `stadium`
  - `arena`
  - `ballpark`
  - `field`

### Exclude conservatively for embedded-office candidates

Exclude `CO` stores when address line 2 or 3 contains tokens such as:

- `building`
- `tower`
- `plaza`
- `suite`
- `ste`
- `floor`
- `level`
- `center`

and the store does not also present a stronger public-retail signal such as:

- `DT`
- `CS`
- `OS`

## Planned Sync Strategy

The official source is usable, but it must be sampled responsibly.

Planned sync approach:

1. Cover the continental U.S. with an overlapping coarse grid.
2. Query cell centers with low concurrency.
3. If a point returns `50`, subdivide that region and retry with smaller cells.
4. Always dedupe by `store.id`.
5. Run Alaska and Hawaii separately.
6. Preserve source payload for auditability.
7. Apply deterministic classification and report exclusion reasons.

Why this approach:

- fixed single-pass queries will miss dense cities because of the `50` cap
- wide-spacing grids will miss sparse regions because the API search radius is finite

## Active Fallback Strategy

Fallback source under active implementation:

- Overture Maps places dataset
- tested release: `2026-02-18.0`

Fallback extract shape:

- filter U.S. places to Starbucks brand/name matches
- preserve:
  - Overture place ID
  - address fields
  - websites
  - phones
  - operating status
  - bounding box coordinates
- dedupe primarily by Starbucks store ID extracted from official `store-locator` URLs when present
- otherwise dedupe by normalized address and phone

Fallback filtering tradeoffs:

- no direct ownership signal like `ownershipTypeCode`
- no reliable universal drive-through/seating metadata
- exclusion relies on:
  - airport/hotel/grocery/hospital/campus/stadium/pickup name/address/URL patterns
  - embedded-office/embedded-retail heuristics

This fallback is therefore weaker than the official-source strategy and must be documented as such.

## Fallback Plan

If the official locator becomes blocked, unstable, or legally impractical at sync scale:

1. stop using it
2. document the blocker in this file
3. switch explicitly to a documented fallback such as OpenStreetMap / Overpass
4. label the changed provenance everywhere relevant

## Current Fallback Run

Latest dry-run result captured on 2026-04-08:

- source: Overture Maps places release `2026-02-18.0`
- raw rows matched: `23,476`
- deduped unique fallback stores: `19,928`
- included stores: `13,532`
- excluded stores: `6,396`

Excluded by reason:

- `ambiguous-format`: `5,093`
- `embedded-office`: `621`
- `campus`: `254`
- `grocery`: `210`
- `airport`: `109`
- `hotel`: `39`
- `hospital`: `36`
- `stadium`: `17`
- `pickup-only`: `17`

Interpretation:

- the fallback intentionally throws away a large block of weak-provenance rows
- included fallback stores are currently restricted to deduped candidates that still retain an official Starbucks `store-locator/store/<id>` URL anchor and do not trip conservative exclusion heuristics
- included fallback `store_type` remains `unknown` because Overture does not reliably expose drive-through or seating signals at nationwide quality

## Pending

- upsert run against a real Supabase project
- measured runtime for the final export + sync pass on a clean run
- optional revalidation of the official Starbucks source if Akamai access conditions change
