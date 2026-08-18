# 06 - Orchestration with Dagster

**Session 6** - 2026-08-17

Wrapped the pipeline in Dagster so it runs in order, on a schedule, with a UI.

- **Software-defined assets**: `bronze` (dlt loader) then `warehouse` (dbt build). Dagster knows `warehouse` depends on `bronze` and runs them in the right order from one command, no manual sequencing.
- **Schedule**: a daily 6am job (`refresh_warehouse`) materializes the whole pipeline.
- **Observability**: `dagster dev` serves a UI with the asset lineage graph, run history, and per-step logs; a failure surfaces instead of passing silently.
- **Caveat**: a schedule only fires while the Dagster daemon is running. `dagster dev` runs it locally; always-on scheduling means deploying Dagster or triggering the job from launchd/cron (the same pattern as the existing COMPA crons).

Verified end to end: `dagster asset materialize` ran `bronze` then `warehouse`, dbt build `PASS=12`.

Next: cloud warehouse (BigQuery) or a serving dashboard.
