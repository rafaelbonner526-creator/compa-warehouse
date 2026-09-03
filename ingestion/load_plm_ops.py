"""PLM operational telemetry -> bronze (dlt). No patient data; see extract_plm_ops.

Write dispositions differ on purpose:

  plm_db_health      APPEND. Each run is one point-in-time catalog snapshot and
                     the trend is the product. A replace-load would leave exactly
                     one row forever and silently destroy the history.
  plm_retrieval_runs REPLACE. The upstream CSV is the complete series, so a
                     replace keeps bronze an exact mirror. Append would duplicate
                     every historical run on every load.

Run:  uv run ingestion/load_plm_ops.py
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

LAND = Path(os.getenv(
    "PLM_OPS_LANDING_DIR",
    str(Path(__file__).parent.parent / "data" / "raw" / "plm_ops"),
))


def load() -> None:
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    pipeline = dlt.pipeline(
        pipeline_name=f"compa_plm_ops_{target}",
        destination=get_destination(),
        dataset_name="bronze",
    )

    for name, table, disposition in (
        ("db_health", "plm_db_health", "append"),
        ("retrieval_runs", "plm_retrieval_runs", "replace"),
    ):
        f = LAND / f"{name}.json"
        if not f.exists():
            print(f"  {name}: MISSING {f}, skipped")
            continue
        df = pd.DataFrame(json.loads(f.read_text()))
        if df.empty:
            print(f"  {name}: no rows, skipped")
            continue
        # Row floors guard replace-loads only. An append cannot shrink a table,
        # so applying a floor to db_health would fail every single run on its
        # one-row snapshot.
        if disposition == "replace":
            check_rows(table, len(df))
        pipeline.run(df.astype(str), table_name=table,
                     write_disposition=disposition)
        print(f"  {name} -> bronze.{table}: {len(df)} rows ({disposition})")


if __name__ == "__main__":
    load()
    print("plm ops bronze loaded")
