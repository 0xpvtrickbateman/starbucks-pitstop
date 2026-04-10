#!/usr/bin/env python3
"""
Import Overture Maps Starbucks data into Supabase, merging with any
previously scraped Starbucks API data for richer metadata.

Sources:
  1. docs/research/latest-overture-starbucks-us.json  (NDJSON, ~23k records)
  2. starbucks_us_stores.json (raw Starbucks API data from scraper, ~1k records)

The Overture data provides comprehensive US coverage; the API data adds
hours, amenities, and other operational details where available.
"""

import json
import os
import re
import urllib.request
import urllib.error
from pathlib import Path

OVERTURE_PATH = "docs/research/latest-overture-starbucks-us.json"
SCRAPED_PATH = "starbucks_us_stores.json"


def load_env(path=".env.local"):
    p = Path(path)
    if not p.exists():
        return
    for line in p.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip())


def extract_store_id(urls: list) -> "str | None":
    """Extract Starbucks numeric store ID from website URLs."""
    for url in (urls or []):
        m = re.search(r'/store(?:-locator/store)?/(\d+)', url)
        if m:
            return m.group(1)
    return None


def load_overture_stores() -> list[dict]:
    """Load NDJSON Overture data."""
    stores = []
    with open(OVERTURE_PATH) as f:
        for line in f:
            line = line.strip()
            if line:
                stores.append(json.loads(line))
    return stores


def load_scraped_stores() -> dict:
    """Load previously scraped Starbucks API data, keyed by store ID."""
    path = Path(SCRAPED_PATH)
    if not path.exists():
        return {}
    raw_list = json.loads(path.read_text())
    by_id = {}
    for store in raw_list:
        sid = store.get("id")
        if sid:
            by_id[str(sid)] = store
    return by_id


def overture_to_row(ov: dict, scraped) -> dict:
    """
    Convert an Overture record to a Supabase stores-table row.
    If we have scraped API data for this store, merge the richer fields.
    """
    store_id = extract_store_id(ov.get("websites"))
    overture_id = ov.get("overture_id")

    # Use Starbucks store ID if available, otherwise overture ID
    row_id = store_id or f"overture:{overture_id}"

    # Coordinates: Overture gives bounding box, take center
    lat = (ov.get("ymin", 0) + ov.get("ymax", 0)) / 2
    lng = (ov.get("xmin", 0) + ov.get("xmax", 0)) / 2

    phone = None
    phones = ov.get("phones") or []
    if phones:
        phone = phones[0]

    row = {
        "id": row_id,
        "name": ov.get("name") or "Starbucks",
        "street1": ov.get("address") or "Unknown address",
        "city": ov.get("city") or "Unknown",
        "state": ov.get("state") or "??",
        "zip": ov.get("zip") or "00000",
        "country": ov.get("country") or "US",
        "latitude": round(lat, 7),
        "longitude": round(lng, 7),
        "phone": phone,
        "store_number": store_id,
        "slug": None,
        "is_excluded": False,
        "source_payload": {
            "source": "overture",
            "overture_id": overture_id,
            "operating_status": ov.get("operating_status"),
            "websites": ov.get("websites"),
            "phones": ov.get("phones"),
            "primary_category": ov.get("primary_category"),
        },
    }

    # Merge richer data from Starbucks API scrape if available
    if scraped:
        addr = scraped.get("address", {}) or {}
        coord = scraped.get("coordinates", {}) or {}
        sched = scraped.get("schedule", []) or []
        mob = scraped.get("mobileOrdering", {}) or {}

        # Prefer API coordinates (more precise)
        if coord.get("latitude") and coord.get("longitude"):
            row["latitude"] = coord["latitude"]
            row["longitude"] = coord["longitude"]

        # Prefer API address details
        if addr.get("streetAddressLine1"):
            row["street1"] = addr["streetAddressLine1"]
        row["street2"] = addr.get("streetAddressLine2")
        row["street3"] = addr.get("streetAddressLine3")
        if addr.get("postalCode"):
            row["zip"] = addr["postalCode"]

        # Operational metadata
        row["ownership_type"] = scraped.get("ownershipTypeCode")
        row["is_company_operated"] = (scraped.get("ownershipTypeCode") == "CO") if scraped.get("ownershipTypeCode") else None
        row["time_zone"] = scraped.get("timeZone")
        row["is_open_24hrs"] = scraped.get("isOpen24Hours")
        row["hours_status"] = scraped.get("hoursStatusFormatted")
        row["mobile_ordering"] = mob.get("availability") if mob else None
        row["slug"] = scraped.get("slug")
        row["market_unit"] = scraped.get("marketBusinessUnitCode")
        row["accepts_non_svc_mop"] = scraped.get("acceptsNonSvcMop")
        row["phone"] = scraped.get("phoneNumber") or row["phone"]
        row["store_number"] = scraped.get("storeNumber") or row["store_number"]

        # Hours
        hours = {}
        for day in sched:
            dow = day.get("dayOfWeek", "")
            if dow:
                hours[dow] = day.get("hoursFormatted", "")
        if hours:
            row["hours"] = hours

        # Arrays
        amenity_names = [a["name"] for a in (scraped.get("amenities") or []) if a.get("name")]
        pickup_names = [p["name"] for p in (scraped.get("pickUpOptions") or []) if p.get("name")]
        feature_names = [f["name"] for f in (scraped.get("internalFeatures") or []) if f.get("name")]
        if amenity_names:
            row["amenities"] = amenity_names
        if pickup_names:
            row["pickup_options"] = pickup_names
        if feature_names:
            row["features"] = feature_names
            row["internal_features"] = feature_names

        # Preserve full raw API payload
        row["source_payload"] = {
            "source": "starbucks_api+overture",
            "overture_id": overture_id,
            "store": scraped,
        }

    return row


def supabase_upsert(url: str, key: str, table: str, rows: list[dict], batch_size=500):
    """Upsert rows into Supabase via PostgREST."""
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates",
    }
    endpoint = f"{url}/rest/v1/{table}"
    total = len(rows)
    uploaded = 0
    errors = 0

    for i in range(0, total, batch_size):
        batch = rows[i : i + batch_size]
        body = json.dumps(batch, default=str).encode("utf-8")
        req = urllib.request.Request(endpoint, data=body, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                uploaded += len(batch)
                pct = uploaded / total * 100
                print(f"  Upserted {uploaded}/{total} ({pct:.1f}%)", end="\r")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            print(f"\n  ✗ Batch {i // batch_size + 1} failed ({e.code}): {error_body[:300]}")
            errors += len(batch)
        except Exception as e:
            print(f"\n  ✗ Batch {i // batch_size + 1} failed: {e}")
            errors += len(batch)

    print(f"\n  Upload complete: {uploaded} upserted, {errors} failed out of {total}")
    return uploaded, errors


def main():
    load_env(".env.local")
    load_env(".env")

    sb_url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
    sb_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not sb_url or not sb_key:
        print("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required in .env.local")
        return

    print("Loading Overture Maps data…")
    overture_stores = load_overture_stores()
    print(f"  {len(overture_stores)} Overture records")

    print("Loading scraped Starbucks API data…")
    scraped_by_id = load_scraped_stores()
    print(f"  {len(scraped_by_id)} scraped stores")

    print("Building store rows…")
    rows = []
    matched = 0
    seen_ids = set()
    skipped_dupes = 0

    for ov in overture_stores:
        store_id = extract_store_id(ov.get("websites"))
        scraped = scraped_by_id.get(store_id) if store_id else None
        if scraped:
            matched += 1

        row = overture_to_row(ov, scraped)

        # Deduplicate by row ID
        if row["id"] in seen_ids:
            skipped_dupes += 1
            continue
        seen_ids.add(row["id"])

        # Skip if missing coordinates
        if not row.get("latitude") or not row.get("longitude"):
            continue

        rows.append(row)

    # Also add any scraped stores not in Overture (shouldn't be many)
    extra = 0
    for sid, store in scraped_by_id.items():
        if str(sid) not in seen_ids:
            coord = store.get("coordinates", {}) or {}
            addr = store.get("address", {}) or {}
            if not coord.get("latitude") or not coord.get("longitude"):
                continue
            row = overture_to_row({
                "overture_id": None,
                "name": store.get("name"),
                "address": addr.get("streetAddressLine1"),
                "city": addr.get("city"),
                "state": addr.get("countrySubdivisionCode"),
                "zip": addr.get("postalCode"),
                "country": addr.get("countryCode"),
                "websites": [f"https://www.starbucks.com/store-locator/store/{sid}"],
                "phones": [store.get("phoneNumber")] if store.get("phoneNumber") else [],
                "ymin": coord["latitude"], "ymax": coord["latitude"],
                "xmin": coord["longitude"], "xmax": coord["longitude"],
            }, store)
            if row["id"] not in seen_ids:
                seen_ids.add(row["id"])
                rows.append(row)
                extra += 1

    print(f"\n  Total rows: {len(rows)}")
    print(f"  Overture+API matched: {matched}")
    print(f"  Scraped-only extras: {extra}")
    print(f"  Skipped duplicates: {skipped_dupes}")

    # State distribution
    from collections import Counter
    state_counts = Counter(r.get("state") for r in rows)
    print(f"\n  Top 10 states:")
    for state, count in state_counts.most_common(10):
        print(f"    {state}: {count}")

    # Normalize all rows to have the same keys (PostgREST requirement)
    # Columns with NOT NULL + DEFAULT constraints must use their defaults, not None
    not_null_defaults = {
        "features": [],
        "amenities": [],
        "pickup_options": [],
        "internal_features": [],
        "hours": {},
        "source_payload": {},
        "is_excluded": False,
        "country": "US",
    }

    all_keys = set()
    for r in rows:
        all_keys.update(r.keys())
    for r in rows:
        for k in all_keys:
            if k not in r:
                r[k] = not_null_defaults.get(k)
            elif r[k] is None and k in not_null_defaults:
                r[k] = not_null_defaults[k]

    print(f"\nUpserting {len(rows)} stores to Supabase…")
    print(f"  Target: {sb_url}")
    uploaded, errors = supabase_upsert(sb_url, sb_key, "stores", rows)

    if errors == 0:
        print("\n✓ All stores imported successfully!")
    else:
        print(f"\n⚠ Import completed with {errors} errors")


if __name__ == "__main__":
    main()
