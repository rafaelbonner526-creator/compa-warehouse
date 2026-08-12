# 01 - Ingestion with dlt + incremental loading

**Session 1** - 2026-08-10

## Goal
<!-- adding capability to ingest new data that appends to the existing data already in warehouse without overwriting  -->

## Environment lessons (1a)
<!-- Answer each in your own words -->
- pip vs uv: when a tool's error says `pip install X`, what do you run in this project, and why doesn't `pip` work here?
-- 'pip' doesn't work because the project is configured to use 'uv' as the package manager. This is a performance optimization that allows for faster package installation and management. 
- Running scripts: why `uv run file.py` instead of `python file.py` or `./file.py`?
-- 'uv run file.py' is used to run scripts in the project's virtual environment. This ensures that the script has access to the correct dependencies and avoids conflicts with other Python environments on the system.
- DuckDB single-writer lock: what caused the IO error, and how did you clear it?
-- The IO error was caused by the previous session not being closed 
- One table, one owner: what went wrong when two loaders wrote `leads_master`, and what's the rule?
-- Writing to the same table by two different loaders causes a conflict. The rule is that each table should have only one loader.
- dlt lineage is format-dependent: why did the pandas path add no `_dlt_` columns, and how did you turn `_dlt_load_id` on?
-- dlt lineage is format-dependent because 
- NOT NULL migration: why couldn't you add `_dlt_load_id` to the existing table, and what did you do instead?
-- We couldn't add `_dlt_load_id` to the existing table because it was 

## Incremental loading (1b)
<!-- This is the headline. Answer in your own words -->
- What is incremental loading, and why does it matter beyond small data?
-- incremental loading focuses on loading only new data not data that has already been loaded to the database. it extends beyond small data since it will be very expensive to reload large datasets
- What is a cursor? Which column did you pick for touch_log and why?
- Why is `touch_log` a good fit for incremental append but `leads_master` is not? (events vs entities)
- What does the primary_key do at the boundary?
- The proof: after running the loader twice with no source change, what were the row count and number of load ids, and why does that
