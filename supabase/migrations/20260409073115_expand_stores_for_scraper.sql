-- Add columns missing from the scraper's output
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS store_number TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS street2 TEXT,
  ADD COLUMN IF NOT EXISTS street3 TEXT,
  ADD COLUMN IF NOT EXISTS country TEXT NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS time_zone TEXT,
  ADD COLUMN IF NOT EXISTS is_open_24hrs BOOLEAN,
  ADD COLUMN IF NOT EXISTS hours_status TEXT,
  ADD COLUMN IF NOT EXISTS hours JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS amenities TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS pickup_options TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS internal_features TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS mobile_ordering TEXT,
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS market_unit TEXT,
  ADD COLUMN IF NOT EXISTS accepts_non_svc_mop BOOLEAN;

-- Rename 'address' to 'street1' for clarity (matches scraper output)
ALTER TABLE stores RENAME COLUMN address TO street1;

-- Update the public read view to include all new columns
DROP VIEW IF EXISTS public_store_read_model;
CREATE VIEW public_store_read_model AS
SELECT
  id,
  store_number,
  name,
  ownership_type,
  store_type,
  phone,
  street1,
  street2,
  street3,
  city,
  state,
  zip,
  country,
  latitude,
  longitude,
  time_zone,
  is_open_24hrs,
  hours_status,
  hours,
  features,
  amenities,
  pickup_options,
  internal_features,
  mobile_ordering,
  slug,
  market_unit,
  accepts_non_svc_mop,
  is_company_operated,
  is_excluded,
  exclusion_reason,
  last_synced_at,
  created_at,
  updated_at
FROM stores;

-- Index on store_number for lookups
CREATE INDEX IF NOT EXISTS idx_stores_store_number ON stores(store_number);;
