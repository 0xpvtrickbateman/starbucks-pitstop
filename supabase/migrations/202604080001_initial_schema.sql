CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS stores (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  ) STORED,
  ownership_type TEXT,
  store_type TEXT,
  features TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  is_company_operated BOOLEAN,
  is_excluded BOOLEAN NOT NULL DEFAULT FALSE,
  exclusion_reason TEXT,
  source_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id TEXT NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code_display TEXT NOT NULL,
  code_normalized TEXT NOT NULL,
  submitted_by_hash TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_reason TEXT,
  upvotes INTEGER NOT NULL DEFAULT 0,
  downvotes INTEGER NOT NULL DEFAULT 0,
  confidence_score DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (store_id, code_normalized)
);

CREATE TABLE IF NOT EXISTS votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES codes(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (code_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_stores_geog ON stores USING GIST (geog);
CREATE INDEX IF NOT EXISTS idx_stores_company_filter
  ON stores(is_excluded, is_company_operated);
CREATE INDEX IF NOT EXISTS idx_codes_store_active
  ON codes(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_votes_code_id
  ON votes(code_id);

DROP TRIGGER IF EXISTS stores_set_updated_at ON stores;
CREATE TRIGGER stores_set_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS codes_set_updated_at ON codes;
CREATE TRIGGER codes_set_updated_at
BEFORE UPDATE ON codes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION wilson_score(ups INTEGER, downs INTEGER)
RETURNS DOUBLE PRECISION
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n INTEGER;
  z DOUBLE PRECISION := 1.96;
  phat DOUBLE PRECISION;
BEGIN
  n := ups + downs;

  IF n = 0 THEN
    RETURN 0;
  END IF;

  phat := ups::DOUBLE PRECISION / n;

  RETURN (
    phat + z * z / (2 * n) - z * SQRT((phat * (1 - phat) + z * z / (4 * n)) / n)
  ) / (1 + z * z / n);
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
SECURITY DEFINER
SET search_path = public
AS $$
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
    UPDATE codes
    SET
      is_active = FALSE,
      deactivated_reason = 'superseded_by_confidence',
      updated_at = NOW()
    WHERE store_id = p_store_id
      AND is_active = TRUE
      AND id <> winner_id
      AND (upvotes + downvotes) >= 5
      AND confidence_score < 0.3;
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
SECURITY DEFINER
SET search_path = public
AS $$
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
SECURITY DEFINER
SET search_path = public
AS $$
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

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE stores FROM anon, authenticated;
REVOKE ALL ON TABLE codes FROM anon, authenticated;
REVOKE ALL ON TABLE votes FROM anon, authenticated;

DROP VIEW IF EXISTS public_store_read_model;
CREATE VIEW public_store_read_model AS
SELECT
  id,
  name,
  address,
  city,
  state,
  zip,
  latitude,
  longitude,
  ownership_type,
  store_type,
  features,
  is_company_operated,
  is_excluded,
  exclusion_reason,
  last_synced_at,
  created_at,
  updated_at
FROM stores;

DROP VIEW IF EXISTS public_code_read_model;
CREATE VIEW public_code_read_model AS
SELECT
  id,
  store_id,
  code_display,
  is_active,
  deactivated_reason,
  upvotes,
  downvotes,
  confidence_score,
  created_at,
  updated_at
FROM codes;
