-- Add Phoenix metro restroom entries confirmed after the initial 2026-04-13 seed.
-- Official Starbucks locator verification on 2026-04-24:
--   1040430  Higley & Elliot                49 S Higley Rd, Gilbert, AZ 85296
--   1009251  56th Street & Indian School    5549 E Indian School Rd, Phoenix, AZ 85018
--
-- `1009251` already exists in the synced store set. `1040430` is absent from
-- the non-excluded store surface, so this migration inserts the official store
-- row before attaching its no-code restroom entry.

INSERT INTO public.stores (
  id,
  store_number,
  name,
  street1,
  city,
  state,
  zip,
  country,
  latitude,
  longitude,
  ownership_type,
  store_type,
  phone,
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
  accepts_non_svc_mop,
  is_company_operated,
  is_excluded,
  exclusion_reason,
  source_payload,
  last_synced_at
)
VALUES (
  '1040430',
  '67951-302199',
  'Higley & Elliot',
  '49 S Higley Rd',
  'Gilbert',
  'AZ',
  '85296',
  'US',
  33.34944,
  -111.72084,
  'CO',
  'drive-thru',
  '+14809565422',
  'GMT+00:00 America/Phoenix',
  FALSE,
  'Open 4:00 AM-9:00 PM',
  '{
    "FRIDAY": "4:00 AM to 9:00 PM",
    "SATURDAY": "4:00 AM to 9:00 PM",
    "SUNDAY": "4:00 AM to 9:00 PM",
    "MONDAY": "4:00 AM to 9:00 PM",
    "TUESDAY": "4:00 AM to 9:00 PM",
    "WEDNESDAY": "4:00 AM to 9:00 PM",
    "THURSDAY": "4:00 AM to 9:00 PM"
  }'::jsonb,
  ARRAY[
    'After Hours Wi-Fi',
    'Cafe Seating',
    'Drive-Thru',
    'Guest Checkout',
    'Guest Ordering',
    'In Store',
    'Mobile Multi Tender',
    'Mobile Order and Pay',
    'Nitro Cold Brew',
    'Outdoor Seating',
    'Oven-warmed Food',
    'Redeem Rewards',
    'Starbucks Wi-Fi',
    'drive-thru'
  ],
  ARRAY[
    'After Hours Wi-Fi',
    'Cafe Seating',
    'Drive-Thru',
    'In Store',
    'Mobile Order and Pay',
    'Nitro Cold Brew',
    'Outdoor Seating',
    'Oven-warmed Food',
    'Redeem Rewards',
    'Starbucks Wi-Fi'
  ],
  ARRAY['In store', 'Drive-thru'],
  ARRAY['Mobile Multi Tender', 'Guest Checkout', 'Guest Ordering'],
  'READY',
  'higley-elliot-49-s-higley-rd-gilbert-az-852961168-us',
  TRUE,
  TRUE,
  FALSE,
  NULL,
  jsonb_build_object(
    'source', 'official-spot-check',
    'verifiedAt', '2026-04-24',
    'officialStoreId', '1040430',
    'classificationNotes', ARRAY['Inserted from live official Starbucks locator verification after the Overture fallback excluded the address as ambiguous-format.'],
    'store', jsonb_build_object(
      'id', '1040430',
      'storeNumber', '67951-302199',
      'name', 'Higley & Elliot',
      'ownershipTypeCode', 'CO',
      'address', jsonb_build_object(
        'streetAddressLine1', '49 S Higley Rd',
        'city', 'Gilbert',
        'countrySubdivisionCode', 'AZ',
        'postalCode', '85296'
      ),
      'coordinates', jsonb_build_object(
        'latitude', 33.34944,
        'longitude', -111.72084
      )
    )
  ),
  NOW()
)
ON CONFLICT (id)
DO UPDATE
SET
  store_number = EXCLUDED.store_number,
  name = EXCLUDED.name,
  street1 = EXCLUDED.street1,
  city = EXCLUDED.city,
  state = EXCLUDED.state,
  zip = EXCLUDED.zip,
  country = EXCLUDED.country,
  latitude = EXCLUDED.latitude,
  longitude = EXCLUDED.longitude,
  ownership_type = EXCLUDED.ownership_type,
  store_type = EXCLUDED.store_type,
  phone = EXCLUDED.phone,
  time_zone = EXCLUDED.time_zone,
  is_open_24hrs = EXCLUDED.is_open_24hrs,
  hours_status = EXCLUDED.hours_status,
  hours = EXCLUDED.hours,
  features = EXCLUDED.features,
  amenities = EXCLUDED.amenities,
  pickup_options = EXCLUDED.pickup_options,
  internal_features = EXCLUDED.internal_features,
  mobile_ordering = EXCLUDED.mobile_ordering,
  slug = EXCLUDED.slug,
  accepts_non_svc_mop = EXCLUDED.accepts_non_svc_mop,
  is_company_operated = EXCLUDED.is_company_operated,
  is_excluded = FALSE,
  exclusion_reason = NULL,
  source_payload = EXCLUDED.source_payload,
  last_synced_at = EXCLUDED.last_synced_at,
  updated_at = NOW();

INSERT INTO public.codes (
  store_id,
  code_display,
  code_normalized,
  submitted_by_hash
)
VALUES
  ('1040430', 'No Code Required', 'NOCODEREQUIRED', 'seed:phoenix-metro-2026-04-24'),
  ('1009251', '55498', '55498', 'seed:phoenix-metro-2026-04-24')
ON CONFLICT (store_id, code_normalized)
DO UPDATE
SET
  code_display = EXCLUDED.code_display,
  updated_at = NOW();
