-- Harden read-model views and RPC execution semantics without changing the
-- app's service-role-based runtime behavior.
--
-- Path 1 decision:
-- - All read-model access in the app flows through createServiceRoleClient().
-- - No browser-side caller reads public_store_read_model or
--   public_code_read_model with the anon key.
-- - We can therefore switch the views to SECURITY INVOKER semantics and
--   explicitly keep anon/authenticated off the view surface.
--
-- The write RPCs are also only invoked through the service-role client, so
-- SECURITY DEFINER is redundant there. Changing them to SECURITY INVOKER
-- preserves current behavior for the app while removing unnecessary privilege
-- elevation if someone ever calls them from a lower-privileged role.

ALTER VIEW public.public_store_read_model SET (security_invoker = true);
ALTER VIEW public.public_code_read_model SET (security_invoker = true);

REVOKE ALL ON TABLE public.public_store_read_model FROM anon, authenticated;
REVOKE ALL ON TABLE public.public_code_read_model FROM anon, authenticated;
GRANT SELECT ON TABLE public.public_store_read_model TO service_role;
GRANT SELECT ON TABLE public.public_code_read_model TO service_role;

CREATE OR REPLACE FUNCTION submit_code_report(
  p_store_id TEXT,
  p_code_display TEXT,
  p_code_normalized TEXT,
  p_submitted_by_hash TEXT
)
RETURNS TABLE (
  id UUID,
  store_id TEXT,
  code_display TEXT,
  is_active BOOLEAN,
  deactivated_reason TEXT,
  upvotes INTEGER,
  downvotes INTEGER,
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  inserted_code_id UUID;
BEGIN
  INSERT INTO codes (
    store_id,
    code_display,
    code_normalized,
    submitted_by_hash
  )
  VALUES (
    p_store_id,
    p_code_display,
    p_code_normalized,
    p_submitted_by_hash
  )
  ON CONFLICT (store_id, code_normalized)
  DO UPDATE SET updated_at = NOW()
  RETURNING codes.id INTO inserted_code_id;

  RETURN QUERY
  SELECT
    c.id,
    c.store_id,
    c.code_display,
    c.is_active,
    c.deactivated_reason,
    c.upvotes,
    c.downvotes,
    c.confidence_score,
    c.created_at,
    c.updated_at
  FROM codes AS c
  WHERE c.id = inserted_code_id;
END;
$$;

CREATE OR REPLACE FUNCTION recompute_store_code_scores(p_store_id TEXT)
RETURNS TABLE (
  id UUID,
  store_id TEXT,
  code_display TEXT,
  is_active BOOLEAN,
  deactivated_reason TEXT,
  upvotes INTEGER,
  downvotes INTEGER,
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  winner_id UUID;
  winner_score DOUBLE PRECISION;
  winner_votes INTEGER;
BEGIN
  UPDATE codes AS c
  SET
    upvotes = vote_counts.up_count,
    downvotes = vote_counts.down_count,
    confidence_score = wilson_score(vote_counts.up_count, vote_counts.down_count),
    updated_at = NOW()
  FROM (
    SELECT
      c2.id,
      COUNT(v.id) FILTER (WHERE v.vote_type = 'up')::INTEGER AS up_count,
      COUNT(v.id) FILTER (WHERE v.vote_type = 'down')::INTEGER AS down_count
    FROM codes AS c2
    LEFT JOIN votes AS v
      ON v.code_id = c2.id
    WHERE c2.store_id = p_store_id
      AND c2.is_active = TRUE
    GROUP BY c2.id
  ) AS vote_counts
  WHERE c.id = vote_counts.id;

  SELECT
    c.id,
    c.confidence_score,
    (c.upvotes + c.downvotes)
  INTO winner_id, winner_score, winner_votes
  FROM codes AS c
  WHERE c.store_id = p_store_id
    AND c.is_active = TRUE
  ORDER BY c.confidence_score DESC, c.upvotes DESC, c.created_at DESC
  LIMIT 1;

  IF winner_id IS NOT NULL
    AND winner_score > 0.65
    AND winner_votes >= 10
    AND NOT EXISTS (
      SELECT 1
      FROM codes AS competitor
      WHERE competitor.store_id = p_store_id
        AND competitor.is_active = TRUE
        AND competitor.id <> winner_id
        AND (competitor.upvotes + competitor.downvotes) >= 5
        AND competitor.confidence_score >= 0.3
    )
  THEN
    UPDATE codes AS c
    SET
      is_active = FALSE,
      deactivated_reason = 'superseded_by_confidence',
      updated_at = NOW()
    WHERE c.store_id = p_store_id
      AND c.is_active = TRUE
      AND c.id <> winner_id
      AND (c.upvotes + c.downvotes) >= 5
      AND c.confidence_score < 0.3;
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.store_id,
    c.code_display,
    c.is_active,
    c.deactivated_reason,
    c.upvotes,
    c.downvotes,
    c.confidence_score,
    c.created_at,
    c.updated_at
  FROM codes AS c
  WHERE c.store_id = p_store_id
  ORDER BY c.is_active DESC, c.confidence_score DESC, c.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION vote_on_code(
  p_code_id UUID,
  p_voter_hash TEXT,
  p_vote_type TEXT
)
RETURNS TABLE (
  id UUID,
  store_id TEXT,
  code_display TEXT,
  is_active BOOLEAN,
  deactivated_reason TEXT,
  upvotes INTEGER,
  downvotes INTEGER,
  confidence_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  target_store_id TEXT;
BEGIN
  IF p_vote_type NOT IN ('up', 'down') THEN
    RAISE EXCEPTION 'invalid_vote_type';
  END IF;

  SELECT c.store_id
  INTO target_store_id
  FROM codes AS c
  WHERE c.id = p_code_id;

  IF target_store_id IS NULL THEN
    RAISE EXCEPTION 'unknown_code';
  END IF;

  INSERT INTO votes (code_id, voter_hash, vote_type)
  VALUES (p_code_id, p_voter_hash, p_vote_type);

  RETURN QUERY
  SELECT *
  FROM recompute_store_code_scores(target_store_id);
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'duplicate_vote';
END;
$$;

ALTER FUNCTION public.set_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.wilson_score(INTEGER, INTEGER) SET search_path = public, pg_temp;
ALTER FUNCTION public.nearby_stores(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INTEGER) SET search_path = public, pg_temp;
ALTER FUNCTION public.search_stores_by_text(TEXT, INTEGER) SET search_path = public, pg_temp;
