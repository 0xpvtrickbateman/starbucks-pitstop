-- search_stores_by_text previously had LIMIT without ORDER BY, so the UI's
-- auto-select-first-result behavior (src/components/home/PitstopShell.tsx)
-- could resolve "Seattle" to arbitrary stores across calls. Rank exact
-- matches first (city, zip, name), then prefix matches, then everything
-- else, with a stable tiebreaker on (name, id) so results[0] is
-- deterministic.

CREATE OR REPLACE FUNCTION search_stores_by_text(
  p_query TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id TEXT,
  name TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  ownership_type TEXT,
  store_type TEXT,
  features TEXT[]
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id, s.name, s.street1 AS address, s.city, s.state, s.zip,
    s.latitude, s.longitude,
    s.ownership_type, s.store_type, s.features
  FROM stores s
  WHERE s.is_excluded = FALSE
    AND (
      s.name ILIKE '%' || p_query || '%'
      OR s.street1 ILIKE '%' || p_query || '%'
      OR s.city ILIKE '%' || p_query || '%'
      OR s.zip ILIKE '%' || p_query || '%'
    )
  ORDER BY
    CASE
      WHEN lower(s.city) = lower(p_query) THEN 0
      WHEN s.zip = p_query THEN 0
      WHEN lower(s.name) = lower(p_query) THEN 1
      WHEN lower(s.city) LIKE lower(p_query) || '%' THEN 2
      WHEN lower(s.name) LIKE lower(p_query) || '%' THEN 3
      ELSE 4
    END,
    s.name,
    s.id
  LIMIT p_limit;
$$;
