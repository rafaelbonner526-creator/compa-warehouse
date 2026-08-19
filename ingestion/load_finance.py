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
    # each is a full-refresh snapshot of the current Monarch state
    pipeline.run(
        frame("accounts"), table_name="mm_accounts", write_disposition="replace"
    )
    pipeline.run(
        frame("categories"), table_name="mm_categories", write_disposition="replace"
    )
    pipeline.run(
        frame("recurring"), table_name="mm_recurring", write_disposition="replace"
    )
    pipeline.run(
        frame("transactions", drop=("tags", "attachments")),
        table_name="mm_transactions",
        write_disposition="replace",
    )
    pipeline.run(
        frame("networth"), table_name="mm_networth", write_disposition="replace"
    )
    pipeline.run(
        frame("holdings"), table_name="mm_holdings", write_disposition="replace"
    )


if __name__ == "__main__":
    load()
    print("finance bronze loaded")
