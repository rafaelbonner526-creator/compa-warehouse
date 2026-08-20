"""Shared dlt destination picker: duckdb (local) or bigquery (cloud).

Selected by WAREHOUSE_TARGET so every loader lands in the same warehouse.
"""

import json
import os
from pathlib import Path

import dlt

# Overridable so the CI fixture path can be exercised locally against a scratch
# database. Without this the only way to test "what CI sees" was to load fixtures
# into the real dev warehouse, which silently replaced real data with synthetic
# rows and produced a confusing cross-source test failure.
_WAREHOUSE = Path(
    os.getenv(
        "WAREHOUSE_DUCKDB_PATH",
        str(Path(__file__).parent.parent / "data" / "warehouse.duckdb"),
    )
)


def get_destination():
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    if target == "bigquery":
        creds = json.load(open(os.environ["GOOGLE_APPLICATION_CREDENTIALS"]))
        return dlt.destinations.bigquery(credentials=creds, location="US")
    return dlt.destinations.duckdb(str(_WAREHOUSE))
