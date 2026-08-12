#!/usr/bin/env python3
"""Bronze layer loader.

Lands raw source files into the `bronze` schema of the DuckDB warehouse with
zero transformation. Bronze = faithful copy of the source, plus lineage
columns (`_loaded_at`, `_source_file`). Cleaning and typing happen later in
silver (dbt). If bronze is wrong, everything downstream is wrong, so bronze
does the least possible: read bytes, stamp provenance, store.

Idempotent: each run fully replaces the bronze tables (CREATE OR REPLACE).
At personal scale a full reload is simpler and safer than incremental; we
switch to incremental in a later session once volume justifies it.

Sources are read-only. This script never writes back to the COMPA vault.
"""

from datetime import datetime, timezone
from pathlib import Path

import duckdb

# --- config ---------------------------------------------------------------
WAREHOUSE = Path(__file__).parent.parent / "data" / "warehouse.duckdb"

# COMPA vault is the read-only source of truth. Absolute paths so this runs
# from anywhere (cron, CI, manual). Never mutate these files.
COMPA_LEADS = Path("/Users/rafaelbonner/COMPA/ampwell/growth/leads")
SOURCES = {
    "leads_master": COMPA_LEADS / "leads-master.csv",
    "touch_log": COMPA_LEADS / "touch-log.csv",
}


def load() -> None:
    con = duckdb.connect(str(WAREHOUSE))
    con.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
    loaded_at = datetime.now(timezone.utc).isoformat()

    for table, path in SOURCES.items():
        if not path.exists():
            raise FileNotFoundError(f"source missing: {path}")

        # Two deliberate bronze choices:
        # 1. all_varchar=true -- store everything as text. Typing is a
        #    silver-layer decision; a bad type guess in bronze silently
        #    corrupts the only untouched copy of the data.
        # 2. explicit dialect (delim/quote/escape) instead of the sniffer.
        #    The touch-log has commas and quotes inside free-text fields
        #    (subject lines, notes), which defeats dialect auto-detection.
        #    Declaring the RFC-4180 dialect makes ingestion deterministic
        #    across files and CI instead of dependent on a heuristic.
        con.execute(
            f"""
            CREATE OR REPLACE TABLE bronze.{table} AS
            SELECT
                *,
                '{loaded_at}'   AS _loaded_at,
                '{path.name}'   AS _source_file
            FROM read_csv(
                ?,
                all_varchar = true,
                header      = true,
                delim       = ',',
                quote       = '"',
                escape      = '"',
                strict_mode = false
            );
            """,
            [str(path)],
        )
        n = con.execute(f"SELECT count(*) FROM bronze.{table}").fetchone()[0]
        print(f"  bronze.{table:<14} <- {path.name:<20} {n:>4} rows")

    con.close()


if __name__ == "__main__":
    print(f"loading bronze -> {WAREHOUSE}")
    load()
    print("done")
