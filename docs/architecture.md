# Architecture

## Principle

The warehouse is built on data I already produce every day. No synthetic
datasets, no tutorial data. The first domain is my cold-outreach pipeline
(leads and touches); later domains (PLM ops, personal finance, fitness) plug
into the same medallion structure.

## Medallion layers

| Layer | Schema | Rule | Owner |
|---|---|---|---|
| Bronze | `bronze` | Faithful copy of the source + lineage columns. No typing, no cleaning, no dedup. | `ingestion/` (Python, dlt) |
| Silver | `silver` | Typed, cleaned, conformed. Business keys resolved. SCD history built. | `dbt` staging + dims |
| Gold | `gold` | Analytics-ready marts. One row per business question. | `dbt` marts |

Why the split: if bronze does the least possible (just land the bytes), then a
bad type guess or a cleaning bug can never silently corrupt the source of
record. Every transformation lives in version-controlled, tested dbt SQL, so
any number can be traced back to raw.

## Data flow

```
  COMPA vault (read-only)              compa-warehouse
  ------------------------             ------------------------------------

  context/leads/
    leads-master.csv  ---------\
    touch-log.csv     ----------+--> ingestion/load_bronze.py
  Gmail / Mailsuite opens ------/          |
                                           v
                                    bronze.leads_master
                                    bronze.touch_log
                                           |
                                        dbt (silver)
                                           |
                            stg_leads,  stg_touches
                            dim_lead (SCD-2),  dim_angle,  dim_date
                                           |
                                        dbt (gold)
                                           |
                            fact_outreach_touch,  fact_email_event
                            mart_outreach_funnel
                                           |
                                           v
                                 daily brief / dashboard
```

## Source contract

- The COMPA vault is **read-only**. This project never writes back to it.
- Sources are CSVs today; the same bronze contract accepts APIs (Gmail,
  Monarch) in later domains via dlt.
- The DuckDB file (`data/warehouse.duckdb`) is a build artifact, gitignored,
  fully reproducible from `uv run ingestion/load_bronze.py` + dbt.

## Planned model grains

| Model | Layer | Grain |
|---|---|---|
| `dim_lead` | silver | one row per lead per status-version (SCD-2) |
| `fact_outreach_touch` | gold | one row per touch per lead per date |
| `fact_email_event` | gold | one row per open/reply event |
| `mart_outreach_funnel` | gold | one row per angle x campaign |
