# 02 - dbt staging (silver)

**Session 2** - 2026-08-11

Added dbt (dbt-duckdb) and built the silver layer: one staging model per
bronze source, materialized as views.

- **Staging rule**: rename, cast types, light clean only. No joins, no business logic. One `stg_` model per source table.
- **Typing deferred from bronze happens here**: `lead_id`/`touch_number` to int, dates to date, `Y/N` and `Yes/No` flags to boolean.
- **Inspect distinct values before casting**: caught two dirty columns in leads (`email_list` mixes `Y/N` with `personal`; `audience_size_estimate` is free text like `65K IG`) and kept them as text instead of force-casting.
- **`TRY_CAST` over `CAST`** on messy sources so a bad value degrades to NULL instead of crashing the model.
- dbt reads bronze via declared **sources** (`_sources.yml`) and writes to a `silver` schema in the same DuckDB file.

Result: `silver.stg_leads` (26 columns kept, the research is the value) and
`silver.stg_touches`, both cleanly typed. Downstream models now build on
silver, never raw bronze.

Next: dbt tests (unique / not_null / relationships) then `dim_lead` with SCD-2.
