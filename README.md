# compa-warehouse

[![dbt CI](https://github.com/rafaelbonner526-creator/compa-warehouse/actions/workflows/ci.yml/badge.svg)](https://github.com/rafaelbonner526-creator/compa-warehouse/actions/workflows/ci.yml)

A personal data platform built on my own daily data exhaust. It ingests the
data I actually generate (starting with my cold-outreach pipeline), models it
into a tested dimensional warehouse, and serves a daily analytics surface I
open every morning.

Built slowly and in public as a hands-on tour of the modern data-engineering
stack. Every phase ships working code, a portfolio artifact, and a written
learning note in [`docs/learnings/`](docs/learnings/).

> Status: **Sessions 0-5 complete.** bronze to silver to gold, typed and tested,
> SCD-2 history, CI green on every push. See the roadmap below.

## Architecture

Medallion architecture (bronze, silver, gold) on a DuckDB warehouse that also
deploys to a cloud warehouse (BigQuery) unchanged.

```
   SOURCES                 BRONZE              SILVER               GOLD
 (read-only)          (raw + lineage)     (clean + modeled)    (analytics-ready)

 leads-master.csv -+
                   +-->  bronze.*  --dbt-->  stg_* , dim_lead -->  mart_outreach_funnel
 touch-log.csv   --+     (as-is,            (typed, SCD-2,        (reply rate by angle,
                   |      _loaded_at)        conformed)            funnel velocity)
 Gmail / opens  --+
                        DuckDB (local)  ==deploys to==  BigQuery (cloud)

          orchestrated by Dagster - quality-gated by dbt tests in CI
```

Full diagram and design rationale: [`docs/architecture.md`](docs/architecture.md).

## Stack

| Layer | Tool |
|---|---|
| Warehouse | DuckDB (dev) then BigQuery (cloud) |
| Ingestion | Python, `dlt` |
| Transformation / modeling | `dbt` |
| Orchestration | Dagster |
| Data quality / DataOps | dbt tests + CI (GitHub Actions) |
| Batch / streaming (capstone) | Spark, Kafka |

## Competencies demonstrated

| Competency | Where |
|---|---|
| Dimensional modeling (star schema, SCD-2) | `models/` (Session 3-4) |
| Incremental & idempotent loading | `ingestion/` (Session 1) |
| Data quality gates in CI/CD | GitHub Actions (Session 5) |
| Pipeline orchestration & lineage | Dagster (Session 6) |
| Local-to-cloud portability | DuckDB to BigQuery (Session 7) |
| Batch & stream processing | Spark, Kafka (Session 8-9) |

## Roadmap

| # | Module | Ships | Status |
|---|---|---|---|
| 0 | Repo + DuckDB + medallion + bronze load | raw CSVs to `bronze.*` | done |
| 1 | `dlt` incremental ingestion | incremental bronze loads | done |
| 2 | dbt staging models | `stg_*` (silver) | done |
| 3 | `dim_lead` with SCD-2 | lead status history | done |
| 4 | Fact tables + gold mart | funnel metrics | done |
| 5 | dbt tests + CI | GitHub Actions gate | done |
| 6 | Dagster | orchestrated daily run | todo |
| 7 | Cloud (BigQuery) | cloud warehouse deploy | todo |
| 8 | Spark | batch reprocessing at scale | todo |
| 9 | Kafka | streaming event ingestion | todo |

## Quickstart

```bash
uv sync
cp .env.example .env   # then set COMPA_LEADS_DIR to your source CSV directory
uv run ingestion/load_bronze_dlt.py
uv run dbt build --profiles-dir .
uv run python -c "import duckdb; con=duckdb.connect('data/warehouse.duckdb'); \
print(con.sql('SELECT table_name, estimated_size FROM duckdb_tables()'))"
```

## Data & privacy

Source files live in a separate private vault and are read-only to this
project. The DuckDB warehouse (`data/*.duckdb`) is gitignored; no personal
data is committed. This repo is the *engineering*, not the data.
