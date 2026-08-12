import dlt
import pandas as pd 
from pathlib import Path


# Rebuild the bronze load using dlt - Goal: learn dlt's pipeline model without also fighting incremental logic 
COMPA_LEADS = Path("/Users/rafaelbonner/COMPA/ampwell/growth/leads")

# Dictionary for sources. We use the tablename as the key and the path to the file as the value.
SOURCES = {
    "leads_master": COMPA_LEADS / "leads-master.csv",
    "touch_log": COMPA_LEADS / "touch-log.csv",
}

destination=dlt.destinations.duckdb("data/warehouse.duckdb")

## Dataset name becomes the schema
# dlt's default disposition is append. So pipeline.run(df, table_name="leads_master") run twice = every row twice, the exact INSERT-duplicates trap
pipeline = dlt.pipeline(pipeline_name="compa_bronze", destination=destination,dataset_name="bronze")

df = pd.read_csv(SOURCES["leads_master"], dtype=str)
df1 = pd.read_csv(SOURCES["touch_log"], dtype=str)

## load the data into the pipeline using the .run() method. 

pipeline.run(df, table_name="leads_master", write_disposition="replace")
pipeline.run(df1, table_name="touch_log", write_disposition="replace")
