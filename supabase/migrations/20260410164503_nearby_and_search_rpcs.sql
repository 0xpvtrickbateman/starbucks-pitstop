-- Server-side RPCs for nearby-store and search queries.
-- Moves distance filtering/ordering and search parameterization
-- into the database, replacing client-side PostgREST workarounds.
-- Note: column `address` was renamed to `street1` in 20260409073115;
-- these RPCs re-alias it as `address` in their return rows so app
-- code can consume them unchanged.

CREATE OR REPLACE FUNCTION nearby_stores(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_meters DOUBLE PRECISION,
  p_limit INTEGER DEFAULT 100
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
  features TEXT[],
  distance_miles DOUBLE PRECISION
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.id, s.name, s.street1 AS address, s.city, s.state, s.zip,
    s.latitude, s.longitude,
    s.ownership_type, s.store_type, s.features,
    ST_Distance(
      s.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) / 1609.344 AS distance_miles
  FROM stores s
  WHERE s.is_excluded = FALSE
    AND ST_DWithin(
      s.geog,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_meters
    )
  ORDER BY ST_Distance(
    s.geog,
    ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  )
  LIMIT p_limit;
$$;

-- Safe parameterized search: avoids raw user-input interpolation
-- into PostgREST .or() filter expressions.
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
  LIMIT p_limit;
$$;
