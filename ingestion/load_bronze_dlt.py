"""Bronze loader (dlt).

Loads the SIGNAL outreach sources into the DuckDB bronze layer:
  - leads_master: mutable entities (a lead's status changes over time)
        -> full refresh (write_disposition="replace"). Merge/SCD comes later.
  - touch_log: append-only events (a logged touch never changes)
        -> incremental append on the `date` cursor, so a re-run loads only
           touches newer than the last run instead of reloading everything.

The source directory is read from COMPA_LEADS_DIR (see .env / .env.example),
so no personal path is hardcoded and the repo stays portable. Sources are
read-only; this never writes back to the vault.
"""

import os
from pathlib import Path

import dlt
import pandas as pd
from dotenv import load_dotenv

load_dotenv()

_leads_dir = os.getenv("COMPA_LEADS_DIR")
if not _leads_dir:
    raise RuntimeError(
        "COMPA_LEADS_DIR is not set. Copy .env.example to .env and set it "
        "to the directory holding leads-master.csv and touch-log.csv."
    )
COMPA_LEADS = Path(_leads_dir)

SOURCES = {
    "leads_master": COMPA_LEADS / "leads-master.csv",
    "touch_log": COMPA_LEADS / "touch-log.csv",
}

pipeline = dlt.pipeline(
    pipeline_name="compa_bronze",
    destination=dlt.destinations.duckdb("data/warehouse.duckdb"),
    dataset_name="bronze",
)


def load_leads() -> None:
    """leads_master: mutable entities -> full refresh each run."""
    df = pd.read_csv(SOURCES["leads_master"], dtype=str)
    pipeline.run(df, table_name="leads_master", write_disposition="replace")


@dlt.resource(name="touch_log", write_disposition="append", primary_key="touch_id")
def touch_log_resource(cursor=dlt.sources.incremental("date")):
    """touch_log: append-only events -> incremental append on the `date` cursor.

    dlt reads the whole CSV but the incremental hint filters the yielded rows
    to those newer than the stored last value; primary_key dedups rows sharing
    the boundary date so each touch loads exactly once.
    """
    df = pd.read_csv(SOURCES["touch_log"], dtype=str)
    yield df.to_dict("records")


if __name__ == "__main__":
    load_leads()
    load_info = pipeline.run(touch_log_resource())
    print(load_info)
