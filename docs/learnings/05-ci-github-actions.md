# 05 - CI with GitHub Actions

**Session 5** - 2026-08-17

Every push now rebuilds the whole pipeline and runs all tests on GitHub Actions.

- **Fixtures, not production data**: CI can't see the private vault, so it builds against small synthetic CSVs (`tests/fixtures/leads`) committed to the repo. Same code path (dlt to bronze to `dbt build`), fake data. You never run CI against production data.
- **Workflow**: install uv, sync deps, load bronze from fixtures, `dbt build` (models + snapshot + tests).
- **Two real CI failures, fixed by reading the logs**:
  - the gitignored `data/` dir doesn't exist in a fresh checkout, so DuckDB couldn't create the file. Fixed with `mkdir -p data`.
  - dlt drops all-null columns on load, so fixtures with empty `reply_sentiment`/`objection_tag` broke `stg_touches`. A fixture must carry a value in every column a model references.
- Green build badge on the README.

Next: Dagster orchestration (scheduled daily runs).
