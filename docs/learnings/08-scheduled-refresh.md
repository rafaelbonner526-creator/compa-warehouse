# 08 - Scheduled cloud refresh (launchd)

**Session 7c** - 2026-08-18

A daily launchd job refreshes BigQuery from the local vault, so the cloud
dashboard updates without any manual run.

- **Why launchd, not GitHub Actions**: the leads source is local CSVs that only change while the laptop is on (SIGNAL writes them there), so a local scheduler is the right tool. A cloud runner can't see the vault. Cloud-API domains (finance/fitness) will use GitHub Actions later, since those can refresh with the laptop off.
- **scripts/refresh.sh**: sources `.env`, sets `WAREHOUSE_TARGET=bigquery`, runs the dlt loader + `dbt build --target prod`.
- **launchd**: `com.compa.warehouse-refresh` runs daily at 7am (`StartCalendarInterval`), logs to `logs/`. Same pattern as the existing COMPA crons.
- Verified: manual run loads bronze to BigQuery + `dbt build` PASS=12; job registered in `launchctl`.

The stack is now hands-off: refresh (launchd) -> BigQuery (cloud) -> Streamlit dashboard (phone), viewer-restricted.
