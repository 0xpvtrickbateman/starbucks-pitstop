# Bug Fix Log

Chronological log of bug-fix passes, keyed by finding. Each entry records:
1. the confirmed root cause (not just the symptom),
2. the fix and the layer it lives in,
3. how the fix was verified.

For broader QA state (automated checks, live smoke, Lighthouse), see `docs/QA.md`.
For narrative release status, see `docs/BUILD_STATUS.md`.

---

## 2026-04-10 — third-pass remediation

### Finding 1 (Medium): Degenerate search input bypassed validation and triggered a full table scan

**Root cause.** `searchQuerySchema` in `src/lib/validators.ts` enforced `z.string().trim().min(2).max(120)` on the *raw* input. Inside `searchStores` in `src/lib/store-data.ts`, the query was then sanitized with `query.replace(/[%_\\]/g, "")` to neutralize LIKE wildcards. Inputs like `"__"`, `"%%"`, `"%_%"`, or `"\\\\"` were length ≥ 2 on the raw string (pass), stripped to `""` (empty sanitized value), and handed to the `search_stores_by_text` RPC as `p_query = ""`. The RPC then ran `ILIKE '%' || '' || '%'` which is `ILIKE '%%'` — an unbounded match against every non-excluded row. Combined with the `ORDER BY` deterministic rank added earlier the same day, this would consistently return the same top-N stores for a garbage query, making it look like a functional search rather than a rejected request.

**Fix.** Moved sanitization into the schema as a Zod `.transform()` and added a post-transform `.refine()` that requires at least 2 alphanumeric characters in the sanitized result. The schema is now the single source of truth:

```ts
q: z
  .string()
  .max(120)
  .transform(sanitizeSearchQuery)
  .refine(sanitized => countAlphanumeric(sanitized) >= 2, {
    message: "Search query is too short or contains only special characters.",
  })
```

`sanitizeSearchQuery` strips `%`, `_`, `\` and collapses whitespace, then trims. `.max(120)` stays on the raw input so an attacker can't force us to regex a 10 MB payload before sanitization.

`searchStores` now trusts the pre-sanitized input. A defensive early-return for `length === 0` is kept for any future internal caller that skips the schema — it refuses the query rather than silently scanning.

**Verification.**
- New unit suite `tests/unit/search-query-schema.test.ts` — 20 cases. Rejects `"__"`, `"%%"`, `"%_%"`, `"\\\\"`, `"   "`, `"*"`, `"%_\\"`, `"_"`, `"%"`, `""`, and over-length input. Accepts `"LA"`, `"TX"`, `"SFO"`, `"Seattle, WA"`, `"Se%attle" → "Seattle"`, `"100% match" → "100 match"`, `"Phoenix, AZ 85016"`. Confirms `sanitizeSearchQuery` is idempotent.
- Live `/api/search` smoke — see the "Final verification" section below.

### Finding 2 (Low): Malformed JSON bodies returned 500 instead of 400

**Root cause.** Both `src/app/api/codes/route.ts` and `src/app/api/votes/route.ts` called `await request.json()` before their Zod parse. When the body is not valid JSON, `request.json()` throws a `SyntaxError`. That error was not a `ZodError` and not an `ApiClientError`, so the shared `apiErrorResponse` helper logged it as an internal failure and returned `{ error: "Internal server error" }` with HTTP 500. A client typo therefore looked like a server fault.

**Fix.** Chose **Option B** from the spec — fix once in the shared helper so it covers all current routes (`locations`, `search`, `codes`, `votes`) and any future route that uses the helper. Added a dedicated `instanceof SyntaxError` branch in `apiErrorResponse` that returns HTTP 400 with `{ error: "Invalid JSON in request body." }`. Ordered after Zod/ApiClientError branches so existing 400/404/409/429 paths are preserved, and before the catch-all `console.error` + 500 so a genuine server error (Supabase down, SQL regression) still surfaces as 500.

The ordering matters: `SyntaxError` is a generic JavaScript error that can theoretically be thrown elsewhere, but in practice its only realistic trigger inside a route handler's try block is `request.json()` on a malformed body. If a future branch introduces a legitimate server-side `SyntaxError` it should be wrapped or converted before reaching the helper.

**Verification.** Live smoke against both routes — see below.

### Finding 3 (Low): Documentation was internally inconsistent on Lighthouse scores

**Root cause.** Three living docs had drifted:
- `README.md` line 176 still reported Performance 35 (the first cold-hit run).
- `docs/QA.md` had both the new rerun (Performance 59, at line ~36) and the historical cold-hit section (Performance 35, at line ~124) without cross-reference.
- `docs/BUILD_STATUS.md` line 16 reported Performance 35 and line 89 said "Lighthouse has not been captured in this environment yet", which contradicted itself.

**Fix.** The most recent verified data — the second-pass rerun of Performance 59 — is the source of truth. All three files now cite 59 as the current score and 35 as the initial cold-hit baseline:

- `README.md`: updated the status headline to cite `Performance 59, Accessibility 100, Best Practices 96, SEO 60`, with an inline note that the initial preview scored 35 before cache warmup. Added a pointer to this log.
- `docs/BUILD_STATUS.md`: updated the `Lighthouse captured — …` line to 59, and replaced the stale "Lighthouse has not been captured in this environment yet" entry in "Known Risks" with a warm-path caveat. Collapsed the stale "Next Actions" list into a pointer at the second-pass section, since those steps are all done.
- `docs/QA.md`: the current rerun section at the top already cited 59. The older "Lighthouse (deployed preview)" section was renamed `Lighthouse (deployed preview, historical)` and explicitly marked as superseded by the rerun.

A subsequent audit (2026-04-10, fourth pass) identified additional stale claims that were missed during this scan: `docs/QA.md` and `docs/BUILD_STATUS.md` still reported the pre-remediation test count (the earlier 33/7 figures) even though the pass in this log added 20 new schema cases and brought the suite to 53/8. Those counts have been corrected in that remediation pass; see the commit titled `docs: fix stale test counts, correct false no-stale-claims assertion, downgrade to release-candidate status`. Additionally, that pass downgraded the living status headline from "Prod-ready" to "Release candidate" to reflect that production-URL smoke, warmed-prod Lighthouse, and real-device/visual regression checks are still open.

---

## Validation after this pass

- `npm run lint` — pass
- `npx tsc --noEmit` — pass
- `npm run build` — pass
- `npm run test` — 53/53 pass (33 prior + 20 new schema cases)
- `npm audit --omit=dev` — 0 vulnerabilities
- `/api/search?q=__` / `%%` / `%_%` / `\\\\` / `   ` / `*` — all return 400 `"Search query is too short or contains only special characters."`
- `/api/search?q=LA` / `TX` / `Seattle` — all return results
- `/api/codes` and `/api/votes` with body `{bad` — both return 400 `"Invalid JSON in request body."`
- `/api/codes` with valid JSON but wrong Zod shape — still returns the structured Zod 400 response
- `/api/codes` / `/api/votes` happy paths — still persist against live Supabase
