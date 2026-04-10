-- Support the DB fallback path in enforceRateLimit() (src/lib/rate-limit.ts).
-- When Upstash is not configured, rate limiting does a COUNT scoped to
-- (hashed_identity, created_at >= now() - window). Without these composite
-- indexes the planner falls back to a sequential scan on codes/votes, which
-- turns every write into a table scan as traffic grows.

CREATE INDEX IF NOT EXISTS idx_codes_submitted_by_hash_created_at
  ON public.codes (submitted_by_hash, created_at DESC)
  WHERE submitted_by_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_votes_voter_hash_created_at
  ON public.votes (voter_hash, created_at DESC);
