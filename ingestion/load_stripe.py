"""Stripe bronze loader (dlt).

Reads the normalized JSON from extract_stripe.py into four bronze tables.
Separate from the finance pipeline because Stripe is business revenue, not
personal finance, and because it refreshes on its own cadence.

Run:  uv run ingestion/load_stripe.py
"""

import json
import os
from pathlib import Path

import dlt
import pandas as pd
from dotenv import load_dotenv

from _destination import get_destination
from extract_stripe import ENDPOINTS

load_dotenv()

LAND = Path(
    os.getenv(
        "STRIPE_LANDING_DIR",
        str(Path(__file__).parent.parent / "data" / "raw" / "stripe"),
    )
)

TABLES = {
    "charges": "stripe_charges",
    "invoices": "stripe_invoices",
    "subscriptions": "stripe_subscriptions",
    "customers": "stripe_customers",
}


def load() -> None:
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    pipeline = dlt.pipeline(
        pipeline_name=f"compa_stripe_{target}",
        destination=get_destination(),
        dataset_name="bronze",
    )
    for name, table in TABLES.items():
        f = LAND / f"{name}.json"
        if not f.exists():
            print(f"  {name}: MISSING {f}, skipped")
            continue
        rows = json.loads(f.read_text())
        # An empty endpoint must still produce a table with its FULL column set.
        # Building it from whatever rows happened to exist means a warehouse with
        # zero subscriptions gets a table with no `status` column, and every
        # downstream model referencing it fails to compile. Schema must not depend
        # on whether data happens to be there: empty and missing are different.
        columns = ENDPOINTS[name][1]
        df = pd.DataFrame(rows, columns=columns) if rows else pd.DataFrame(columns=columns)
        pipeline.run(df.astype(str), table_name=table, write_disposition="replace")
        print(f"  {name} -> bronze.{table}: {len(df)} rows")


if __name__ == "__main__":
    load()
    print("stripe bronze loaded")
