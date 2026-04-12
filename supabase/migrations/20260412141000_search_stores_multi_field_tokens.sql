-- Expand search_stores_by_text beyond single-column ILIKE matching so inputs
-- like "Seattle, WA", "Phoenix, AZ 85016", bare state codes ("WA"), and
-- ZIP-only queries can resolve through the same RPC contract. Keep the logic
-- in SQL so every caller shares the same tokenizer and ranking rules.

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
SET search_path = public, pg_temp
AS $$
  WITH normalized_query AS (
    SELECT
      lower(trim(p_query)) AS query_lower,
      array_remove(
        regexp_split_to_array(
          regexp_replace(lower(trim(p_query)), '[,\s]+', ' ', 'g'),
          ' '
        ),
        ''
      ) AS tokens
  ),
  classified_tokens AS (
    SELECT
      nq.query_lower,
      COALESCE(
        array_agg(token) FILTER (WHERE token ~ '^\d{5}$'),
        ARRAY[]::text[]
      ) AS zip_tokens,
      COALESCE(
        array_agg(token) FILTER (WHERE token ~ '^[a-z]{2}$'),
        ARRAY[]::text[]
      ) AS state_tokens,
      COALESCE(
        array_agg(token) FILTER (
          WHERE token !~ '^\d{5}$'
            AND token !~ '^[a-z]{2}$'
        ),
        ARRAY[]::text[]
      ) AS text_tokens
    FROM normalized_query nq
    CROSS JOIN LATERAL unnest(nq.tokens) AS token
    GROUP BY nq.query_lower
  ),
  search_terms AS (
    SELECT
      query_lower,
      zip_tokens,
      state_tokens,
      text_tokens,
      NULLIF(array_to_string(text_tokens, ' '), '') AS text_phrase
    FROM classified_tokens
  ),
  candidate_stores AS (
    SELECT
      s.id,
      s.name,
      s.street1 AS address,
      s.city,
      s.state,
      s.zip,
      s.latitude,
      s.longitude,
      s.ownership_type,
      s.store_type,
      s.features,
      lower(s.name) AS name_lower,
      lower(s.street1) AS street_lower,
      lower(
        regexp_replace(
          regexp_replace(
            regexp_replace(
              regexp_replace(
                regexp_replace(
                  regexp_replace(
                    regexp_replace(
                      regexp_replace(
                        regexp_replace(
                          regexp_replace(lower(s.street1), '\mpl\M', 'place', 'g'),
                          '\mst\M',
                          'street',
                          'g'
                        ),
                        '\mave\M',
                        'avenue',
                        'g'
                      ),
                      '\mblvd\M',
                      'boulevard',
                      'g'
                    ),
                    '\mrd\M',
                    'road',
                    'g'
                  ),
                  '\mdr\M',
                  'drive',
                  'g'
                ),
                '\mhwy\M',
                'highway',
                'g'
              ),
              '\mcir\M',
              'circle',
              'g'
            ),
            '\mct\M',
            'court',
            'g'
          ),
          '\mpkwy\M',
          'parkway',
          'g'
        )
      ) AS street_expanded_lower,
      lower(s.city) AS city_lower,
      lower(s.state) AS state_lower,
      lower(s.zip) AS zip_lower
    FROM stores s
    WHERE s.is_excluded = FALSE
  )
  SELECT
    s.id,
    s.name,
    s.address,
    s.city,
    s.state,
    s.zip,
    s.latitude,
    s.longitude,
    s.ownership_type,
    s.store_type,
    s.features
  FROM candidate_stores s
  CROSS JOIN search_terms t
  WHERE NOT EXISTS (
      SELECT 1
      FROM unnest(t.state_tokens) AS state_token
      WHERE s.state_lower <> state_token
    )
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(t.zip_tokens) AS zip_token
      WHERE s.zip_lower <> zip_token
    )
    AND (
      cardinality(t.text_tokens) = 0
      OR NOT EXISTS (
        SELECT 1
        FROM unnest(t.text_tokens) AS text_token
        WHERE NOT (
          s.name_lower LIKE '%' || text_token || '%'
          OR s.street_lower LIKE '%' || text_token || '%'
          OR s.street_expanded_lower LIKE '%' || text_token || '%'
          OR s.city_lower LIKE '%' || text_token || '%'
          OR s.state_lower LIKE '%' || text_token || '%'
          OR s.zip_lower LIKE text_token || '%'
        )
      )
    )
  ORDER BY
    CASE
      WHEN t.text_phrase IS NOT NULL
        AND s.city_lower = t.text_phrase THEN 0
      WHEN t.text_phrase IS NOT NULL
        AND s.name_lower = t.text_phrase THEN 1
      WHEN t.text_phrase IS NOT NULL
        AND (
          s.street_lower = t.text_phrase
          OR s.street_expanded_lower = t.text_phrase
        ) THEN 2
      WHEN t.text_phrase IS NOT NULL
        AND s.city_lower LIKE t.text_phrase || '%' THEN 3
      WHEN t.text_phrase IS NOT NULL
        AND s.name_lower LIKE t.text_phrase || '%' THEN 4
      WHEN t.text_phrase IS NOT NULL
        AND (
          s.street_lower LIKE '%' || t.text_phrase || '%'
          OR s.street_expanded_lower LIKE '%' || t.text_phrase || '%'
        ) THEN 5
      WHEN cardinality(t.zip_tokens) > 0 THEN 6
      WHEN cardinality(t.state_tokens) > 0 THEN 7
      ELSE 8
    END,
    s.city,
    s.name,
    s.id
  LIMIT p_limit;
$$;
