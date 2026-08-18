# 10 - Finance marts + Budget dashboard (Engine A)

**Session 8** - 2026-08-18

Completed the budget engine: silver staging, gold marts, and a Budget dashboard tab.

- **Models**: `stg_transactions/accounts/categories`; ephemeral `int_transactions` (transfers + hidden rows removed, signed amounts split into expense/income); marts `mart_safe_to_spend`, `mart_monthly_cashflow`, `mart_spend_by_category`, `mart_account_balances`.
- **Safe-to-spend** grounded in the ALTO 70% Living bucket, rolling 30/7-day windows, groceries counted as flexible.
- **Portable date SQL**: `dbt.date_trunc`, `dbt.dateadd`, and a dispatched `today()` macro so the marts build on both DuckDB and BigQuery. Integer coefficients (`* 7 / 30`) keep NUMERIC math portable.
- **Dual-target dlt fix**: target-specific pipeline names (`compa_finance_{target}`) so dev/prod keep separate state instead of conflicting on a destination switch.
- **Dashboard**: Budget tab, safe-to-spend, cashflow history + 3-month forecast, spend-by-category, net worth + accounts. CI covered via synthetic Monarch fixtures.

Next: Engine B (investment signals) + GitHub Actions cron for cloud-API market data.
