# 00 - Why medallion, and why bronze does the least

**Session 0** - 2026-08-06

## Goal

Stand up the repo and land my two outreach source files (`leads-master.csv`,
`touch-log.csv`) into a DuckDB warehouse as the bronze layer. No modeling yet.

## What I built

- `uv`-managed Python 3.12 project with DuckDB.
- `ingestion/load_bronze.py`: reads both CSVs into a `bronze` schema, adds
  `_loaded_at` and `_source_file` lineage columns, nothing else.
- Medallion folder + schema layout (bronze/silver/gold).

## What I learned

**Medallion architecture** splits the pipeline into three layers with one job
each:

- **Bronze**: a faithful copy of the source. Same shape as the CSV, plus
  provenance. The point is that bronze is *boring on purpose*. It does not
  clean, type, or dedup, because any logic here is logic that can silently
  corrupt the only untouched copy of the data I have.
- **Silver**: typed and cleaned. This is where `status` becomes an enum, dates
  become dates, and lead history gets modeled.
- **Gold**: analytics-ready marts, one row per business question.

**The key decision this session:** I read the CSVs with `all_varchar=true`, so
every column lands as text. The instinct is to let DuckDB sniff types on load,
but a wrong guess in bronze (a ZIP read as int, a mixed column truncated) is
invisible and downstream everything inherits the corruption. Typing is a
*silver* decision made in tested SQL, where it is explicit and reversible.

**Idempotency:** the loader uses `CREATE OR REPLACE`, so running it twice is
safe and produces the same result. At ~130 rows a full reload is trivially
cheap; I will earn incremental loading in Session 1 when I switch to `dlt`,
where the interesting problem (only load new/changed rows) actually bites.

## Real-world snag: the CSV that would not sniff

The touch-log refused to load. DuckDB's dialect sniffer failed even after I set
the delimiter, quote, and escape explicitly. Debugging steps:

1. Parsed the file with Python's `csv` module: 152 valid rows, 12 columns each,
   zero unbalanced quotes. So the file is RFC-4180 compliant, not corrupt.
2. Byte check: 144 lines carried carriage returns, and several `notes` fields
   contain quoted multi-line text.

The fix was `strict_mode=false`. DuckDB's strict mode enforces RFC compliance
so aggressively that CR characters plus embedded newlines in quoted fields
defeat the dialect heuristic. Relaxing strict mode (while keeping the explicit
dialect) made ingestion deterministic.

Lesson: real source files are messy, and "it opens in Excel/Python" does not
mean every engine parses it the same way. Bronze ingestion needs explicit,
documented handling of source quirks, not a heuristic that works today and
breaks when the next row has a comma in a comment.

## Interview version

> "I used a medallion architecture so raw ingestion and business logic are
> strictly separated. Bronze is an untyped, faithful landing zone with lineage
> columns; all typing and cleaning happen in version-controlled dbt models
> downstream, which keeps transformations testable and traceable back to raw."

## Next session

Session 1: replace the hand-rolled loader with `dlt` and implement incremental
loading (load only new touches since the last run).
