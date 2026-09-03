"""Macro bronze loader (dlt), Engine B / macro.

Reads the FRED observations JSON (from extract_fred.py) and loads it into
bronze.fred_observations. Independent of the Monarch/leads pipelines, so the
macro cron can refresh it in the cloud on its own.

Run:  set -a; source .env; set +a; uv run ingestion/load_macro.py
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
        "FRED_LANDING_DIR",
        str(Path(__file__).parent.parent / "data" / "raw" / "fred"),
    )
)


def load() -> None:
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    pipeline = dlt.pipeline(
        pipeline_name=f"compa_macro_{target}",
        destination=get_destination(),
        dataset_name="bronze",
    )
    records = json.loads((LAND / "observations.json").read_text())
    df = pd.DataFrame(records).rename(
        columns={"date": "obs_date", "value": "obs_value"}
    )
    check_rows("fred_observations", len(df))
    pipeline.run(
        df.astype(str), table_name="fred_observations", write_disposition="replace"
    )


if __name__ == "__main__":
    load()
    print("macro bronze loaded")
