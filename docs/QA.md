# QA Log

Last updated: 2026-04-08 MST

## Status

Automated verification is in place and currently green for lint, production build, unit tests, and mocked browser flows.

## Automated Results

- `npm run lint`
  - passed on 2026-04-08
- `npm run build`
  - passed on 2026-04-08
- `npm run test`
  - passed on 2026-04-08
- `npm run test:e2e`
  - passed on 2026-04-08
  - coverage is mocked at the network layer for:
    - geolocation denied fallback copy
    - search selecting a store
    - showing old-code history
    - submitting a code
    - voting on a code
    - desktop and mobile-emulated layouts

## Manual / Visual Checks Completed

- Desktop shell rendered locally over HTTP and returned `200`
- Metadata assets are present in the rendered HTML:
  - favicon
  - manifest
  - Apple touch icon
  - OG metadata
- The app shell loads without type or lint failures
- Mobile behavior received browser-level regression coverage through Playwright emulation

## Remaining Manual Checks

- 375px device with live Supabase data
- 768px tablet with live Supabase data
- 1024px desktop with live Supabase data
- 1440px desktop with live Supabase data
- real Mapbox token visual verification
- live vote/code persistence against production Supabase
- Lighthouse run against a deployed URL

## Known Limitations

- No live Supabase-backed QA was possible in this environment because project credentials were not provided.
- The official Starbucks source is research-verified but currently blocked for unattended sync from this environment by Akamai `403` responses.
- Lighthouse has not been recorded yet.
- The Playwright MCP browser tool in this environment was not usable because it failed to initialize its own filesystem state, so browser verification used the local Playwright package instead.
