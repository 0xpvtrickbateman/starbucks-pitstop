#!/usr/bin/env python3

import argparse
import json
import sys

try:
    import duckdb
except ImportError as error:
    print(
        json.dumps(
            {
                "message": "duckdb is required for the Overture fallback sync",
                "error": str(error),
                "suggestion": "python3 -m pip install --user duckdb",
            }
        ),
        file=sys.stderr,
    )
    sys.exit(1)


DEFAULT_RELEASE = "2026-02-18.0"
DEFAULT_PATH_TEMPLATE = (
    "s3://overturemaps-us-west-2/release/{release}/theme=places/type=place/*"
)


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", default=DEFAULT_RELEASE)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def main():
    args = parse_args()
    dataset_path = DEFAULT_PATH_TEMPLATE.format(release=args.release)

    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")

    query = f"""
        SELECT
            id AS overture_id,
            names.primary AS name,
            brand.names.primary AS brand_name,
            categories.primary AS primary_category,
            basic_category,
            addresses[1].freeform AS address,
            addresses[1].locality AS city,
            addresses[1].region AS state,
            addresses[1].postcode AS zip,
            addresses[1].country AS country,
            operating_status,
            websites,
            phones,
            bbox.xmin AS xmin,
            bbox.xmax AS xmax,
            bbox.ymin AS ymin,
            bbox.ymax AS ymax
        FROM read_parquet('{dataset_path}')
        WHERE addresses[1].country = 'US'
          AND lower(coalesce(brand.names.primary, names.primary)) LIKE '%starbucks%'
    """
    safe_output = args.output.replace("'", "''")
    con.execute(f"COPY ({query}) TO '{safe_output}' (FORMAT JSON)")

    with open(args.output, "r", encoding="utf-8") as handle:
        row_count = sum(1 for _ in handle)

    print(
        json.dumps(
            {
                "message": "Exported Overture Starbucks rows",
                "release": args.release,
                "datasetPath": dataset_path,
                "rowCount": row_count,
                "output": args.output,
            }
        )
    )


if __name__ == "__main__":
    main()
