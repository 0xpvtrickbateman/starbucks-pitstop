-- Seed verified Phoenix metro restroom entries collected on 2026-04-13.
-- Official Starbucks locator matches:
--   7540    44th St. & Thomas, Phoenix        2824 N 44th St
--   14069   16th Street & Bethany Home, Ph    1601 E Bethany Home Rd
--   116525  Rural & Lakeshore                 4475 S Rural Rd
--   1005596 7th St. & Osborn                  650 E Osborn Rd
--   1007783 N Scottsdale Rd & N Goldwater     3530 N Goldwater Blvd
--   1005602 28th St & Indian School           2802 E Indian School Rd
--   1022226 7th & Highland                    4717 N 7th St
--
-- Deliberately omitted for now:
--   1040430 Higley & Elliot (49 S Higley Rd, Gilbert, AZ 85296)
--   The live official locator resolves this store, but the synced store set
--   initially contained only an excluded Overture row at that address
--   (`overture:9ae6313b-411c-4099-9c3d-faa8cbe110f0`, `ambiguous-format`).
--   A follow-up migration on 2026-04-24 repairs this store row and seeds its
--   no-code restroom entry.

INSERT INTO public.codes (
  store_id,
  code_display,
  code_normalized,
  submitted_by_hash
)
SELECT
  seed.store_id,
  seed.code_display,
  seed.code_normalized,
  'seed:phoenix-metro-2026-04-13'
FROM (
  VALUES
    ('7540', '23629', '23629'),
    ('14069', '1601#', '1601#'),
    ('116525', '78920', '78920'),
    ('1005596', '45678', '45678'),
    ('1007783', '1190#', '1190#'),
    ('1005602', '4268#', '4268#'),
    ('1022226', 'No Code Required', 'NOCODEREQUIRED')
) AS seed(store_id, code_display, code_normalized)
JOIN public.stores AS stores
  ON stores.id = seed.store_id
 AND stores.is_excluded = FALSE
ON CONFLICT (store_id, code_normalized)
DO UPDATE
SET
  code_display = EXCLUDED.code_display,
  updated_at = NOW();
