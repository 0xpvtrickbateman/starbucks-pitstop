# Build Status

Last updated: 2026-04-08 MST

## Current State

- Phase 0 research has been completed and documented.
- The app now builds successfully as a deployable Next.js project.
- Secure Supabase-backed route handlers, mobile-first UI flows, metadata assets, sync tooling, and automated tests are in place.
- The store sync backbone is validated enough to support deployment once real environment variables are supplied:
  - official Starbucks locator contract verified
  - official automation path documented as blocked/unstable from this environment
  - explicit Overture fallback count captured

## Completed

- Verified official Starbucks design references from Starbucks-owned sources
- Chosen safe open-source font equivalents
- Defined initial app design tokens
- Verified live Starbucks store-locator endpoint and response behavior
- Verified finite-radius and 50-result-cap limitations
- Established a conservative filtering strategy and fallback plan
- Saved a sanitized sample response to `docs/research/sample-store-response.json`
- Scaffolded the Next.js app in the current workspace
- Installed the required core and testing dependencies
- Added the first secure Supabase migration scaffold
- Implemented a source-aware sync runner with explicit fallback support
- Captured the first nationwide fallback sync result:
  - `rawRows`: `23,476`
  - `uniqueStores`: `19,928`
  - `includedStores`: `13,532`
  - `excludedStores`: `6,396`
- Added secure Supabase migration SQL with RLS, views, and transactional vote/code functions
- Implemented server-mediated `locations`, `search`, `codes`, and `votes` route handlers
- Wired the map shell, search flow, detail sheet/sidebar, code submission, voting, and old-code history UI
- Generated favicon, manifest, Apple touch icon, and OG image assets from the supplied logo
- Added unit coverage for normalization, validation, and scoring helpers
- Added mocked Playwright coverage for desktop and mobile search/submit/vote flows
- Verified:
  - `npm run lint`
  - `npm run build`
  - `npm run test`
  - `npm run test:e2e`

## In Progress

- Live environment validation against a real Supabase project and populated `stores` table
- Lighthouse measurement against a running deployed URL
- Final manual QA pass at all target viewport widths with real data

## Known Risks

- Official locator endpoint has no observed public pagination contract
- Coordinate queries have a finite search radius and can return `[]`
- Company-operated stores still include some non-qualifying environments, so secondary heuristics are required
- `creative.starbucks.com` presented an expired TLS certificate during shell research, though its content remained readable from the official domain
- The official Starbucks locator is now returning Akamai `403 Access Denied` responses to this automation environment, which makes the primary sync path unstable for unattended use
- The Overture fallback is publicly queryable, but it has weaker ownership/type fidelity than the official Starbucks response
- Browser automation tests are currently mocked at the network layer; they verify the product flows but not a live Supabase-backed deployment
- Lighthouse has not been captured in this environment yet

## Next Actions

1. Provision Supabase and Mapbox environment variables.
2. Run `npm run sync-stores -- --source=overture` against the real Supabase project.
3. Deploy to Vercel and verify live location queries, code submission, and voting with production data.
