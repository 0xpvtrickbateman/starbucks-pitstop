# Starbucks Pitstop Design Research

Last updated: 2026-04-12 19:56 MST

## 2026-04-12 Mobile shell behavior update

- The phone detail surface is intentionally three-state now:
  - `collapsed` shows only the bottom header rail
  - `peek` leaves a short preview above the map instead of occupying the full viewport
  - `open` reveals the full detail sheet
- The map shell should keep a definite viewport-bound height chain (`dvh`-based flex sizing) instead of relying on percentage heights through `min-height` alone.
- Reason: mobile Safari can mount a visually blank Mapbox canvas if the container size is unresolved at first paint, even when the map instance has already loaded and the store query has already succeeded.

## Scope

This document captures the verified Phase 0 design and data-contract research for Starbucks Pitstop.

The product will be Starbucks-inspired, but it will not ship proprietary Starbucks assets beyond public factual references used for research. The attached custom logo replaces the Starbucks siren everywhere in the implementation.

## Verified Sources

- Official Starbucks Creative Expression guide:
  - `https://creative.starbucks.com/color/`
  - `https://creative.starbucks.com/typography/`
  - `https://creative.starbucks.com/theory/`
  - `https://creative.starbucks.com/voice/`
  - `https://creative.starbucks.com/logos/`
- Official live Starbucks site:
  - `https://www.starbucks.com/store-locator`
  - `https://www.starbucks.com/`
- Live Starbucks site assets observed on 2026-04-08:
  - store-locator HTML and JS bundles fetched directly from `www.starbucks.com`
  - live CSS bundle noted by parallel research: `https://www.starbucks.com/_next/static/css/a238819714180add.css`

## Provenance Notes

- The public Creative Expression guide footer still shows `© 2020 Starbucks Coffee Company`.
- The same domain remains useful as an official reference, but the shell observed an expired TLS certificate on `creative.starbucks.com` during this research. Content was still inspected from the same official domain with `curl -k`, and cross-checked against the live `www.starbucks.com` site before any implementation choice was made.
- Inference: the 2020 guide is not a fresh marketing refresh, but the core greens and `SoDoSans` are still reflected by the live Starbucks website in 2026.

## Official Brand Colors Observed

Canonical colors from the official Creative Expression guide:

| Official name | Hex | Notes |
| --- | --- | --- |
| Starbucks Green | `#006241` | Primary brand green in the official guide |
| Accent Green | `#00754A` | Secondary accent green |
| Light Green | `#D4E9E2` | Soft background/support green |
| House Green | `#1E3932` | Deep neutral green |
| Warm Neutral | `#F2F0EB` | Warm background neutral |
| Cool Neutral | `#F9F9F9` | Cool background neutral |
| Black | `#000000` | Core neutral |
| White | `#FFFFFF` | Core neutral |

Live-site color signals also observed on 2026-04-08:

| Token/source | Value | Interpretation |
| --- | --- | --- |
| Homepage/store-locator `theme-color` | `#006341` | Live implementation variant, close to primary green |
| `mask-icon` color | `#008046` | Live metadata variant |
| Live CSS | `#EDEBE9` | Ceramic-like neutral seen in current site tokens |
| Live CSS | `#2B5148` | Green uplift/deeper utility green |
| Live CSS | `#CBA258` | Gold accent used in illustrations/details |

Implementation decision:

- Treat `#006241`, `#00754A`, `#1E3932`, `#D4E9E2`, `#F2F0EB`, and `#F9F9F9` as the verified reference set.
- Treat `#006341` and `#008046` as live implementation variants, not the canonical source of truth.

## Official Typography Observed

Official public type family names from the Creative Expression guide:

- `SoDo Sans`
- `Lander`
- `Pike`

Observed live CSS family naming variants:

- `SoDoSans`
- `Lander Tall`
- `Lander Grande`
- `Pike` is documented in the Creative Expression guide, but was not found in the current homepage CSS bundle inspected during research.

Official role guidance from Starbucks-owned sources:

- `SoDo Sans` is the general-purpose sans and the most versatile face.
- `Lander` is the serif accent for more expressive moments.
- `Pike` is the condensed functional face for impactful headlines and wayfinding.

## Approved Implementation Equivalents

The app will not ship Starbucks proprietary fonts.

Chosen open-source equivalents:

| Official role | Safe implementation font | Why |
| --- | --- | --- |
| SoDo Sans | `Geist` | Clean modern sans, excellent Next.js support via `next/font` |
| SoDo Sans fallback | `Inter` | Good fallback/reference equivalent if Geist needs replacement |
| Lander | `Fraunces` | Expressive serif that can handle premium display moments |
| Pike | `IBM Plex Sans Condensed` | Open-source condensed family suitable for utility labels and wayfinding |

Implementation rules:

- Use `next/font` only.
- Do not download or embed Starbucks font files.
- Use the custom uploaded logo instead of the siren mark.
- Avoid Starbucks-like wordmark treatment or siren-derived iconography.

## Chosen App Design Tokens

These are implementation tokens for Starbucks Pitstop, derived from verified Starbucks color roles but adjusted to keep the product distinct and safely custom-branded.

```css
:root {
  --brand-primary: #1f4a3d;
  --brand-primary-dark: #16362e;
  --brand-primary-soft: #dce9e0;
  --brand-accent: #cba258;

  --surface-base: #fbfaf7;
  --surface-card: #f5f1e8;
  --surface-muted: #ede9df;

  --text-primary: #171717;
  --text-secondary: #5d605a;
  --text-inverse: #ffffff;

  --state-success: #2f7a62;
  --state-warning: #9a6a17;
  --state-muted: #a3a7a0;

  --radius-sm: 12px;
  --radius-md: 18px;
  --radius-lg: 24px;
  --shadow-card: 0 12px 30px rgba(22, 54, 46, 0.10);
}
```

Chosen typography roles:

```css
:root {
  --font-sans: "Geist", "Inter", system-ui, sans-serif;
  --font-display: "Fraunces", Georgia, serif;
  --font-functional: "IBM Plex Sans Condensed", "Roboto Condensed", sans-serif;
}
```

Rationale:

- The app keeps the Starbucks-inspired green and warm-neutral logic.
- The deeper custom primary green avoids a one-to-one visual match.
- Fraunces adds warmth without pretending to be Lander.
- IBM Plex Sans Condensed gives us a practical analog for Pike’s wayfinding role.

## Store Locator: Verified Network Behavior

### Official page inspected

- `https://www.starbucks.com/store-locator`

### Verified endpoint

- `GET https://www.starbucks.com/apiproxy/v1/locations`

### Verified request behavior

- The live store-locator bundles build same-origin requests to `/apiproxy/v1/locations`.
- Observed request headers from the live client code:
  - `Accept: application/json`
  - `X-Requested-With: XMLHttpRequest`
  - same-origin credentials in the browser client
- Verified query shapes:
  - `?place=Seattle%2C%20WA`
  - `?lat=47.6062&lng=-122.3321`
  - optional `features=...` is present in the bundle contract, but observed behavior suggests feature filtering is only partially honored server-side and is still refined client-side.

### Verified response behavior

- Successful place or coordinate lookups return a JSON array.
- Dense queries are capped at `50` results.
- Results are sorted by ascending `distance`.
- Invalid place queries return HTTP `200` with:

```json
{"placeNameNotFound": true}
```

- Coordinate queries with no nearby stores return:

```json
[]
```

### Observed schema

Top-level array item keys:

- `distance`
- `isFavorite`
- `isNearby`
- `isPrevious`
- `recommendationReason`
- `store`

Observed `store` object keys:

- `id`
- `storeNumber`
- `name`
- `ownershipTypeCode`
- `phoneNumber`
- `open`
- `closingSoon`
- `isOpen24Hours`
- `openStatusFormatted`
- `hoursStatusFormatted`
- `address`
- `schedule`
- `amenities`
- `pickUpOptions`
- `coordinates`
- `mobileOrdering`
- `regulations`
- `acceptsNonSvcMop`
- `acceptedCampusCardIssuers`
- `warningLabels`
- `slug`
- `timeZone`
- `internalFeatures`
- `marketBusinessUnitCode`

### Fields useful for filtering

Strongest observed signals:

- `ownershipTypeCode`
  - `CO` observed for company-operated candidates
  - `LS` observed for licensed locations
- `marketBusinessUnitCode`
  - observed licensed-environment examples:
    - `HOST` and `AREASUSA` for airports
    - `TARGCO` for Target
    - `KROGERCO` for QFC/Fred Meyer
    - `ALBERTSN` for Safeway / Star Market
    - `PROVIHEA` for hospitals

### Automation blocker observed after initial verification

After the initial shell-based verification succeeded, subsequent non-browser requests to both:

- `https://www.starbucks.com/store-locator`
- `https://www.starbucks.com/apiproxy/v1/locations`

started returning Akamai `403 Access Denied` HTML responses from this environment.

Observed details:

- HTTP status: `403`
- response content type: `text/html`
- server: `AkamaiGHost`
- representative body text: `Access Denied`

Interpretation:

- the official locator contract was still verifiable for research
- the same source is not stable enough to rely on for unattended sync automation from this environment
- this satisfies the product requirement to stop, document the blocker clearly, and switch to an explicit fallback source rather than pretending the primary sync path is production-safe

## Fallback Dataset Research

### Chosen fallback

- Overture Maps places dataset
- release tested: `2026-02-18.0`
- cloud path used for research:
  - `s3://overturemaps-us-west-2/release/2026-02-18.0/theme=places/type=place/*`

Why this fallback was chosen:

- publicly documented cloud-hosted dataset
- queryable with DuckDB without scraping the Starbucks website
- includes U.S. Starbucks place candidates with:
  - brand/name
  - freeform address
  - city/state/ZIP
  - phone
  - official Starbucks store-locator URLs on many rows
  - bounding box coordinates that can be converted into map points

### Overture schema observed

Fields used in the fallback extract:

- `id`
- `names.primary`
- `brand.names.primary`
- `categories.primary`
- `basic_category`
- `addresses[1].freeform`
- `addresses[1].locality`
- `addresses[1].region`
- `addresses[1].postcode`
- `addresses[1].country`
- `websites`
- `phones`
- `operating_status`
- `bbox`

### Overture-specific caveats

- Overture does not expose Starbucks ownership fields equivalent to `ownershipTypeCode`.
- Overture does not reliably expose amenity-level signals such as drive-through, seating, or restroom indicators for every location.
- Therefore the fallback classifier must lean more heavily on name/address/URL heuristics and should be considered weaker than the official-source filter.
    - `UOFWASHI` for university
    - `MAR-INTL` for Marriott
- `amenities`
  - useful codes observed: `DT`, `CS`, `OS`, `GO`, `XO`, `WA`
- `pickUpOptions`
  - observed `DT` and `16`
- `mobileOrdering.guestOrdering`
- `acceptsNonSvcMop`
- `address.streetAddressLine2`
- `address.streetAddressLine3`
- `slug`

### Important contract constraints

- The API is not a nationwide cursor or pagination API.
- It returns the nearest stores within a finite search radius, capped at `50`.
- Example findings:
  - `Seattle, WA` and downtown-coordinate queries both returned `50` stores.
  - A rural Wyoming coordinate query returned `[]`, while `place=Cheyenne, WY` returned `8` stores.
  - Around Cheyenne, moving the query point north still returned results through about `25` miles, but returned `0` results by `30` miles north.

Implication:

- Nationwide ingestion must use overlapping geographic queries.
- Dense metros need subdivision because `50` means truncation.
- Sparse regions still need enough coverage because off-grid coordinate queries can return nothing.

## Conservative Filtering Strategy

### Inclusion baseline

Include only records that are candidate company-operated stores:

- `ownershipTypeCode === "CO"`

### Clear exclusions

Exclude when clearly identifiable:

- any `ownershipTypeCode !== "CO"` as licensed
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
- hospital / secure-access patterns:
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
- pickup-only / small-format patterns:
  - `pickup`
  - `grab & go`

### Embedded-office heuristic

For `CO` stores, exclude conservative embedded-office candidates when:

- `address.streetAddressLine2` or `address.streetAddressLine3` contains tokens such as:
  - `building`
  - `tower`
  - `plaza`
  - `suite`
  - `ste`
  - `floor`
  - `level`
  - `center`
- and the location does not also present a stronger public-retail signal like `DT`, `CS`, or `OS`

Reason:

- Company-operated does not guarantee restroom-keypad relevance.
- Verified CO counterexamples exist:
  - `Copley Marriott`
  - `Pickup - U Village North`
  - `Secure Access SCH River-Floor`
  - office-building embedded downtown stores

### Public-retail positive signals

Signals that increase confidence, but do not override hard exclusions:

- `DT` in `amenities` or `pickUpOptions`
- `CS` in `amenities`
- `OS` in `amenities`
- `GO` in `amenities`
- `guestOrdering === true`
- `acceptsNonSvcMop === true`

## Conclusion

The research gate is satisfied for design and contract verification:

- official colors were verified from Starbucks-owned sources
- official typography roles were verified from Starbucks-owned sources
- open-source implementation equivalents were selected
- the live locator endpoint and response contract were verified
- viable filtering signals were identified
- the nationwide sync will require an adaptive overlapping-grid approach because the official endpoint is radius-limited and capped at 50 results
