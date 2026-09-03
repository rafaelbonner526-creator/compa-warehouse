"""Long-history bronze loader (dlt).

Reads the normalized JSON written by extract_longhistory.py and loads five
bronze tables. Kept separate from the macro pipeline because these datasets are
revised annually at most, so they must not ride the daily FRED cron.

Run:  uv run ingestion/load_longhistory.py
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
        "LONGHISTORY_LANDING_DIR",
        str(Path(__file__).parent.parent / "data" / "raw" / "longhistory"),
    )
)

TABLES = {
    "shiller": "lh_shiller",
    "jst": "lh_jst",
    "boe": "lh_boe",
    "maddison": "lh_maddison",
    "imf_debt": "lh_imf_debt",
}


def load() -> None:
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    pipeline = dlt.pipeline(
        pipeline_name=f"compa_longhistory_{target}",
        destination=get_destination(),
        dataset_name="bronze",
    )
    for name, table in TABLES.items():
        f = LAND / f"{name}.json"
        if not f.exists():
            print(f"  {name}: MISSING {f}, skipped")
            continue
        df = pd.DataFrame(json.loads(f.read_text()))
        check_rows(table, len(df))
        pipeline.run(df.astype(str), table_name=table, write_disposition="replace")
        print(f"  {name} -> bronze.{table}: {len(df)} rows")


if __name__ == "__main__":
    load()
    print("long-history bronze loaded")
