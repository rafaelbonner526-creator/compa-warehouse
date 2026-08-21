{{ config(materialized='incremental', unique_key='snapshot_date') }}
-- Daily snapshot of the handful of numbers a review actually turns on.
--
-- WHY: every other mart answers "what is true now". None of them can answer "what
-- changed since you last looked", which is the only question a periodic review
-- cares about. Without history, a digest can only restate the dashboard, and a
-- digest that restates the dashboard is just the dashboard with extra steps.
--
-- Incremental and keyed on the date, so re-running the same day overwrites rather
-- than duplicating, and a missed day simply leaves a gap rather than corrupting
-- the series. This starts thin and gets more useful with every run; that is the
-- nature of a time series and not a reason to defer building it.
SELECT
    cast({{ today() }} as date)                                          AS snapshot_date,
    (SELECT us_pct FROM {{ ref('mart_evidence_bands') }} WHERE scope = 'Active')      AS active_us_pct,
    (SELECT equity_value FROM {{ ref('mart_evidence_bands') }} WHERE scope = 'Combined') AS combined_equity,
    (SELECT count(*) FROM {{ ref('mart_portfolio_actions') }} WHERE status = 'act')   AS open_actions,
    (SELECT avg_monthly_spend FROM {{ ref('mart_safe_to_spend') }})                   AS avg_monthly_spend,
    (SELECT actual_savings_rate_pct FROM {{ ref('mart_safe_to_spend') }})             AS savings_rate_pct,
    (SELECT liquid_savings FROM {{ ref('mart_runway') }})                             AS liquid_savings,
    (SELECT runway_months FROM {{ ref('mart_runway') }})                              AS runway_months,
    (SELECT net_collected FROM {{ ref('mart_revenue') }})                             AS revenue_collected,
    (SELECT paying_customers FROM {{ ref('mart_revenue') }})                          AS paying_customers,
    (SELECT cape FROM {{ ref('mart_valuation') }})                                    AS cape,
    (SELECT quadrant FROM {{ ref('mart_macro_regime') }})                             AS regime,
    (SELECT count(*) FROM {{ ref('mart_data_freshness') }} WHERE status = 'stale')    AS stale_sources
-- A dummy FROM is required: this SELECT is entirely scalar subqueries, and
-- BigQuery rejects "Query without FROM clause cannot have a WHERE clause" when the
-- incremental branch below appends its filter. DuckDB accepts the bare form, so
-- this compiled on dev and failed only on prod.
FROM (SELECT 1) AS one
{% if is_incremental() %}
WHERE cast({{ today() }} as date) NOT IN (SELECT snapshot_date FROM {{ this }})
{% endif %}
