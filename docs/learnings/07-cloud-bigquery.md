# 07 - Cloud warehouse (BigQuery)

**Session 7** - 2026-08-18

Migrated the warehouse to BigQuery so the data lives in the cloud, reachable
without the laptop. dbt and dlt now target either DuckDB (local dev) or
BigQuery (prod) from the same code.

- **Dual-target**: `profiles.yml` has a duckdb `dev` and a bigquery `prod` target; the dlt loader picks its destination from `WAREHOUSE_TARGET`. Local dev and CI stay on DuckDB + fixtures; prod runs against BigQuery.
- **Auth**: a GCP service account (BigQuery Data Editor + Job User) with a JSON key, referenced by path via `GOOGLE_APPLICATION_CREDENTIALS`, never committed.
- **Portable SQL via `adapter.dispatch`**: dbt's built-in `safe_cast` is a plain (erroring) cast on DuckDB, so a custom `try_cast_null` macro dispatches to `TRY_CAST` (duckdb) vs `SAFE_CAST` (bigquery). The same models build on both.
- **Surfaced real dirty data**: a column-shifted source row put notes text in `next_action_date`; the portable safe-cast NULLs it instead of crashing the build.
- Verified: `dbt build` PASS=12 on both targets; the gold mart is queryable live in BigQuery (bronze/silver/gold datasets).

Next: deploy the Streamlit dashboard (pointed at BigQuery) and scheduled cloud runs (GitHub Actions).
