"""Finance bronze loader (dlt), Engine A / budget.

Reads the Monarch JSON landing files (written by extract_monarch.py) and loads
them into the bronze layer as flat, all-text tables (the same bronze contract
as the leads loader). Nested dicts are flattened (account, category, merchant);
noisy list fields (tags, attachments) are dropped, they aren't needed for
budgeting and would spawn dlt child tables.

Run (after extract_monarch.py):
  set -a; source .env; set +a
  uv run ingestion/load_finance.py
"""

import json
import os
from pathlib import Path

import dlt
import pandas as pd
from dotenv import load_dotenv

from _destination import get_destination
from _guards import check_rows

load_dotenv()

LAND = Path(
    os.getenv(
        "MONARCH_LANDING_DIR",
        str(Path(__file__).parent.parent / "data" / "raw" / "monarch"),
    )
)


def frame(name: str, drop: tuple = ()) -> pd.DataFrame:
    """Flatten a Monarch JSON record list into a bronze-ready all-text frame."""
    records = json.loads((LAND / f"{name}.json").read_text())
    df = pd.json_normalize(records, sep="__")
    df = df.drop(columns=[c for c in drop if c in df.columns], errors="ignore")
    # any leftover list/dict cells -> JSON strings (faithful bronze, no child tables)
    for c in df.columns:
        if df[c].apply(lambda v: isinstance(v, (list, dict))).any():
            df[c] = df[c].apply(
                lambda v: (
                    json.dumps(v, default=str) if isinstance(v, (list, dict)) else v
                )
            )
    return df.astype(str)


def load() -> None:
    # target-specific pipeline name so duckdb (dev) and bigquery (prod) keep
    # separate dlt state instead of conflicting on a destination switch
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    pipeline = dlt.pipeline(
        pipeline_name=f"compa_finance_{target}",
        destination=get_destination(),
        dataset_name="bronze",
    )
    # Each is a full-refresh snapshot of current Monarch state, so an empty frame
    # would DELETE the table rather than add nothing. check_rows refuses that.
    # See ingestion/_guards.py for why the floors are what they are.
    for name, table, drop in (
        ("accounts", "mm_accounts", ()),
        ("categories", "mm_categories", ()),
        ("recurring", "mm_recurring", ()),
        ("transactions", "mm_transactions", ("tags", "attachments")),
        ("networth", "mm_networth", ()),
        ("holdings", "mm_holdings", ()),
    ):
        df = frame(name, drop=drop)
        check_rows(table, len(df))
        pipeline.run(df, table_name=table, write_disposition="replace")
        print(f"  {name} -> bronze.{table}: {len(df)} rows")


if __name__ == "__main__":
    load()
    print("finance bronze loaded")
