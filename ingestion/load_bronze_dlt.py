"""Bronze loader (dlt), dual-target.

Loads the SIGNAL outreach sources into the bronze layer:
  - leads_master: mutable entities -> full refresh (replace).
  - touch_log: append-only events -> incremental append on the `date` cursor.

Destination is chosen by WAREHOUSE_TARGET:
  - "duckdb"   (default) -> local data/warehouse.duckdb
  - "bigquery"           -> BigQuery, using the service-account key at
                            GOOGLE_APPLICATION_CREDENTIALS

Source dir comes from COMPA_LEADS_DIR (.env). Sources are read-only.
"""

import os
from pathlib import Path

import dlt
import pandas as pd
from dotenv import load_dotenv

from _destination import get_destination

load_dotenv()

_leads_dir = os.getenv("COMPA_LEADS_DIR")
if not _leads_dir:
    raise RuntimeError("COMPA_LEADS_DIR not set. Copy .env.example to .env.")
COMPA_LEADS = Path(_leads_dir)

SOURCES = {
    "leads_master": COMPA_LEADS / "leads-master.csv",
    "touch_log": COMPA_LEADS / "touch-log.csv",
}


def load() -> None:
    pipeline = dlt.pipeline(
        pipeline_name="compa_bronze",
        destination=get_destination(),
        dataset_name="bronze",
    )

    # leads_master: mutable entities -> full refresh each run.
    df = pd.read_csv(SOURCES["leads_master"], dtype=str)
    pipeline.run(df, table_name="leads_master", write_disposition="replace")

    # touch_log: append-only events -> incremental append on the `date` cursor.
    # primary_key dedups rows sharing the boundary date so each loads once.
    @dlt.resource(name="touch_log", write_disposition="append", primary_key="touch_id")
    def touch_log_resource(incremental=dlt.sources.incremental("date")):
        df1 = pd.read_csv(SOURCES["touch_log"], dtype=str)
        yield df1.to_dict("records")

    pipeline.run(touch_log_resource())


if __name__ == "__main__":
    print(f"loading bronze -> {os.getenv('WAREHOUSE_TARGET', 'duckdb')}")
    load()
    print("done")
