# Wave 2 Verification Summary
Generated: 2026-04-10 20:38 MST

---

## Canonical host

- Production URL: `https://starbucks-pitstop.vercel.app/`
- Current production deployment: `dpl_13WcCUXpgHz46ZVgHfeVo6z6mQBu`
- Canonical-host result after redirect removal:
  - `curl -I https://starbucks-pitstop.vercel.app/` -> `HTTP/2 200`
  - `curl -I https://stopatstarbucks.vercel.app/` -> `HTTP/2 200`
- Vercel alias state:
  - both `starbucks-pitstop.vercel.app` and `stopatstarbucks.vercel.app` remained attached to the same production deployment

## Smoke checks

Runbook source: `docs/RELEASE_RUNBOOK.md`, checks 1–6 with `PROD_URL=starbucks-pitstop.vercel.app`.

| Check | Result |
|---|---|
| `/` | `HTTP/2 200` |
| `/api/locations?bbox=-122.5,47.4,-122.2,47.7` | 156 stores, `meta.source: "supabase"` |
| `/api/locations?lat=47.6062&lng=-122.3321&radius=5` | 73 stores, ordered by distance |
| `/api/search?q=pike` | 10 stores |
| `/api/search?q=a` | expected `400` validation response |
| `/manifest.webmanifest` | `HTTP/2 200` |

## Browser verification

Canonical host checked in-browser at 375 / 768 / 1024 / 1440 widths.

- Page loaded successfully at every width.
- Console stayed clean: 0 errors, 0 warnings during app verification.
- Search field accepted input on the canonical host.
- Searching `Seattle` auto-selected `35th & Fauntleroy`.
- The store detail panel rendered correctly with:
  - store title
  - active-code section
  - submit-code section

## Lighthouse

Reports saved to:

- `docs/research/lighthouse-production.report.html`
- `docs/research/lighthouse-production.report.json`
- `docs/research/lighthouse-production-warm.report.html`
- `docs/research/lighthouse-production-warm.report.json`

These committed copies are sanitized for version control. Embedded Mapbox access-token values captured in Lighthouse network URLs were redacted without changing the recorded scores or conclusions.

Scores:

| Pass | Performance | Accessibility | Best Practices | SEO |
|---|---:|---:|---:|---:|
| First production pass | 42 | 100 | 96 | 100 |
| Warmed production pass | 81 | 100 | 96 | 100 |

## Conclusion

Wave 2 passed on the canonical production URL.

The release blocker was the Vercel dashboard redirect on `starbucks-pitstop.vercel.app`. That redirect has been removed, the canonical host now serves the production deployment directly, the smoke suite passes on the canonical URL, and the warmed production Lighthouse run is strong enough to close the launch gate.

Remaining work is post-launch hardening:

- physical-device spot check for geolocation and touch-map behavior
- Provision Upstash before any traffic-scale event if you want production off the indexed DB fallback path. Current production enforcement is verified, but `vercel env ls production` confirms the Upstash vars are not configured.
