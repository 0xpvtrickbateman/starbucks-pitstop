<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Starbucks Pitstop Guardrails

- Verify Starbucks store-data behavior against the live official locator before changing the sync contract.
- Never embed Starbucks proprietary fonts, siren marks, or copied wordmarks.
- Use the uploaded custom logo for all product branding and metadata assets.
- Keep all writes server-mediated. Anonymous clients must never write directly to sensitive Supabase tables.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code or browser bundles.
- Persist only hashed or HMAC'd device identifiers. Never store or return raw device IDs.
- Keep filtering conservative. When a store is ambiguous, prefer exclusion with a documented reason over optimistic inclusion.
- Preserve a running paper trail in `docs/BUILD_STATUS.md`, `docs/DECISIONS.md`, `docs/DESIGN.md`, `docs/STORE_SYNC_REPORT.md`, and `docs/QA.md`.
