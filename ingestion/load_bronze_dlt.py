import os

import dlt
import pandas as pd
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


# Rebuild the bronze load using dlt - Goal: learn dlt's pipeline model without also fighting incremental logic
WAREHOUSE = Path(__file__).parent.parent / "data" / "warehouse.duckdb"

# Source dir from COMPA_LEADS_DIR (.env), so no personal path is hardcoded.
_leads_dir = os.getenv("COMPA_LEADS_DIR")
if not _leads_dir:
    raise RuntimeError("COMPA_LEADS_DIR not set. Copy .env.example to .env.")
COMPA_LEADS = Path(_leads_dir)

# Dictionary for sources. We use the tablename as the key and the path to the file as the value.
SOURCES = {
    "leads_master": COMPA_LEADS / "leads-master.csv",
    "touch_log": COMPA_LEADS / "touch-log.csv",
}


def load() -> None:
    destination = dlt.destinations.duckdb(str(WAREHOUSE))
    ## Dataset name becomes the schema
    # dlt's default disposition is append. So pipeline.run(df, table_name="leads_master") run twice = every row twice, the exact INSERT-duplicates trap
    pipeline = dlt.pipeline(
        pipeline_name="compa_bronze", destination=destination, dataset_name="bronze"
    )

    df = pd.read_csv(SOURCES["leads_master"], dtype=str)

    ## load the data into the pipeline using the .run() method.
    pipeline.run(df, table_name="leads_master", write_disposition="replace")

    # @dlt.resource turns the function into something dlt can load with per-run behavior
    # write_disposition="append" tells dlt to append new rows to the table.
    # primary_key="touch_id" tells dlt that the "touch_id" column is the primary key for the table.
    # dlt.sources.incremental("date") is a function that returns a cursor that dlt can use to track the last time the resource was loaded.
    @dlt.resource(name="touch_log", write_disposition="append", primary_key="touch_id")
    def touch_log_resource(incremental=dlt.sources.incremental("date")):
        df1 = pd.read_csv(SOURCES["touch_log"], dtype=str)
        yield df1.to_dict("records")  # yield dict rows so dlt can filter by the cursor

    pipeline.run(touch_log_resource())


# Need to add that it actually worked
if __name__ == "__main__":
    print(f"loading bronze -> {WAREHOUSE}")
    load()
    print("done")
