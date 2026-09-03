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
from _guards import check_rows

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
    target = os.getenv("WAREHOUSE_TARGET", "duckdb")
    pipeline = dlt.pipeline(
        # Target-specific, matching every other loader. Previously this was the bare
        # name "compa_bronze", so the dev and prod runs shared one dlt state
        # directory: whichever ran last decided what the other believed it had
        # already loaded. The other three pipelines were given a target suffix for
        # exactly this reason and this one was missed.
        pipeline_name=f"compa_bronze_{target}",
        destination=get_destination(),
        dataset_name="bronze",
    )

    # Both tables are full-refresh mirrors of their CSV.
    #
    # touch_log used to be an incremental append keyed on `date`, which is why the
    # pipeline could not simply be renamed: renaming resets dlt state, the cursor
    # would restart at the beginning, and every historical row would append a second
    # time. That coupling is now removed rather than worked around.
    #
    # Replace is the honest model here. The CSV is the full history, maintained by
    # the SIGNAL skills, and it is small (162 rows). Verified before switching:
    # bronze.touch_log held exactly the CSV's 162 rows with zero duplicates, so
    # nothing existed in the warehouse that the file did not also have. Incremental
    # loading was optimising a table that fits in a spreadsheet, at the cost of
    # state that made the pipeline un-renameable.
    # leads_master was always a plain full-refresh load, so a bare DataFrame is fine.
    df = pd.read_csv(SOURCES["leads_master"], dtype=str)
    check_rows("leads_master", len(df))
    pipeline.run(df, table_name="leads_master", write_disposition="replace")

    # touch_log keeps the RESOURCE form with primary_key, and only its disposition
    # changes from append to replace. That is deliberate: a keyed resource makes dlt
    # add a `_dlt_id` column, and the table in both warehouses already has one.
    # Loading a bare DataFrame instead produces a schema without `_dlt_id`, which
    # BigQuery rejects outright ("Field _dlt_id is missing in new schema") and DuckDB
    # rejects as a NOT NULL violation. Same table, same key, new disposition.
    # Guard BEFORE the resource runs. A dlt.resource is a generator, so counting
    # inside it would only raise mid-load, after dlt had already begun replacing.
    # Read the file once here, check it, then hand the same rows to the resource.
    touch_rows = pd.read_csv(SOURCES["touch_log"], dtype=str).to_dict("records")
    check_rows("touch_log", len(touch_rows))

    @dlt.resource(name="touch_log", write_disposition="replace", primary_key="touch_id")
    def touch_log_resource():
        yield touch_rows

    pipeline.run(touch_log_resource())
    print(f"  touch_log -> bronze.touch_log: {len(touch_rows)} rows")


if __name__ == "__main__":
    print(f"loading bronze -> {os.getenv('WAREHOUSE_TARGET', 'duckdb')}")
    load()
    print("done")
