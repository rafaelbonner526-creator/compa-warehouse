# 01 - Ingestion with dlt + incremental loading

**Session 1** - 2026-08-11

Replaced a hand-rolled bronze loader with dlt and added incremental loading
for the append-only touch log.

- **dlt over a hand-rolled script** for schema handling, load tracking, and restartable loads.
- **Load strategy fits the source**: `leads_master` is a mutable entity (status changes) so it is a full refresh; `touch_log` is append-only events so it uses **incremental append** with a `date` cursor + `touch_id` primary key. Only new touches load on a re-run.
- **Per-row lineage** via `_dlt_load_id` (enabled in `.dlt/config.toml`; the pandas/arrow path omits it by default).
- **Config, not hardcoding**: the source directory comes from `COMPA_LEADS_DIR` (`.env`), so the repo is portable and holds no personal paths.
- **Verified the right way**: a no-op re-run leaves the load id **unchanged** (incremental), where a full refresh would mint a new one. Checking the id *value*, not just the row count, is what distinguishes the two.

Next: dbt staging (silver).
