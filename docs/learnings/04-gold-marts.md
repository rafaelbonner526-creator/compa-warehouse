# 04 - Gold marts (fact + funnel)

**Session 4** - 2026-08-17

Built the gold layer: a skinny fact table and an aggregated funnel mart, the
first analytics deliverable of the project.

- **fact_touch**: one row per touch (event grain), foreign key to the lead, booleans stored as additive `1/0` measures (`is_open`, `is_reply`) so they sum cleanly.
- **mart_outreach_funnel**: reply/open rates by angle, aggregated from `fact_touch`. Same output as the `outreach-metrics` script, but modeled, tested, and reproducible.
- **Fact vs dimension**: touches are immutable events (fact table, append-only); leads are entities with changing state (SCD-2 dimension). Different kinds of data get different patterns; a fact stays skinny (FKs + measures) and joins to dimensions at query time.
- **Custom schema names**: overrode `generate_schema_name` so `+schema` lands literally (`gold`, not `silver_gold`). Marts materialize as tables (serving layer); staging stays views.
- **Divide-by-zero guard**: `NULLIF(denominator, 0)` turns a `0/0` nan into a clean `NULL`. `count(*)` needs no guard (never 0 for a group that exists); `sum(is_open)` does.

Next: CI (GitHub Actions) then orchestration (Dagster) for scheduled daily runs.
