"""Dagster orchestration for the compa-warehouse pipeline.

Two software-defined assets with an explicit dependency:

    bronze  (dlt loader)  ->  warehouse  (dbt build: models + snapshot + tests)

Dagster runs them in dependency order, on a daily schedule, with a UI that
shows lineage, run history, and failures.

Run the UI:        uv run dagster dev -f orchestration/definitions.py
Materialize once:  uv run dagster asset materialize -f orchestration/definitions.py --select "*"
"""

import subprocess
import sys
from pathlib import Path

from dagster import (
    AssetExecutionContext,
    Definitions,
    ScheduleDefinition,
    asset,
    define_asset_job,
)

PROJECT_ROOT = Path(__file__).parent.parent
# Use the venv's console scripts so this works regardless of PATH.
DBT_BIN = str(Path(sys.executable).parent / "dbt")


@asset(compute_kind="dlt")
def bronze(context: AssetExecutionContext) -> None:
    """Load leads + touches into the DuckDB bronze layer via the dlt loader."""
    subprocess.run(
        [sys.executable, "ingestion/load_bronze_dlt.py"],
        cwd=PROJECT_ROOT,
        check=True,
    )
    context.log.info("bronze loaded from source into DuckDB")


@asset(deps=[bronze], compute_kind="dbt")
def warehouse(context: AssetExecutionContext) -> None:
    """Build all dbt models, snapshots, and tests on top of bronze."""
    subprocess.run(
        [DBT_BIN, "build", "--profiles-dir", "."],
        cwd=PROJECT_ROOT,
        check=True,
    )
    context.log.info("dbt build complete (silver + gold + snapshot + tests)")


# A job that materializes the whole pipeline, and a daily 6am schedule for it.
refresh_job = define_asset_job("refresh_warehouse", selection="*")
daily_schedule = ScheduleDefinition(
    job=refresh_job,
    cron_schedule="0 6 * * *",  # every day at 06:00 local
)

defs = Definitions(
    assets=[bronze, warehouse],
    jobs=[refresh_job],
    schedules=[daily_schedule],
)
