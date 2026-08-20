-- Dalio's three equilibriums, one row.
--
-- 1. Debt vs income      -- federal debt as % of GDP, level and 1-year change.
-- 2. Capacity            -- capacity utilization vs its own long-run average.
--                           "Long-run" = the mean over the pulled window, which
--                           extract_fred pulls in full for this series (1967+), so
--                           the average is a real long-run reference. Against a
--                           20-year window capacity looked normal; against its full
--                           history there is meaningful slack, because utilization
--                           has trended down structurally.
-- 3. Risk-premium stack  -- cash < government bonds < corporate credit. Dalio's
--                           point is that the stack must slope upward; an inversion
--                           anywhere is a tightening / late-cycle signal.
--
-- The equity rung of the stack is NOT measured. There is no free FRED series for
-- an equity earnings yield, and inventing one would be worse than leaving it out.
-- stack_shape describes the three rungs that ARE measured, and the UI says so.
WITH obs AS (
    SELECT series, obs_date, value FROM {{ ref('stg_fred') }} WHERE value IS NOT NULL
),
latest AS (
    SELECT series, value AS lv, obs_date AS ld
    FROM obs
    QUALIFY row_number() OVER (PARTITION BY series ORDER BY obs_date DESC) = 1
),
yrago AS (
    SELECT o.series, o.value AS yv
    FROM obs o JOIN latest l ON o.series = l.series
    WHERE o.obs_date <= cast({{ dbt.dateadd('month', -12, 'l.ld') }} as date)
    QUALIFY row_number() OVER (PARTITION BY o.series ORDER BY o.obs_date DESC) = 1
),
avgs AS (SELECT series, avg(value) AS mean_all, count(*) AS n_obs FROM obs GROUP BY series),
metrics AS (
    SELECT l.series, l.lv AS latest_value, y.yv AS year_ago_value, a.mean_all, a.n_obs
    FROM latest l
    LEFT JOIN yrago y ON l.series = y.series
    LEFT JOIN avgs  a ON l.series = a.series
),
wide AS (
    SELECT
        max(CASE WHEN series = 'debt_to_gdp' THEN round(latest_value, 1) END)                    AS debt_to_gdp,
        max(CASE WHEN series = 'debt_to_gdp' THEN round(latest_value - year_ago_value, 1) END)   AS debt_to_gdp_chg_1y,
        max(CASE WHEN series = 'capacity_utilization' THEN round(latest_value, 1) END)           AS capacity_utilization,
        max(CASE WHEN series = 'capacity_utilization' THEN round(mean_all, 1) END)               AS capacity_longrun_avg,
        max(CASE WHEN series = 'capacity_utilization' THEN n_obs END)                            AS capacity_n_obs,
        max(CASE WHEN series = 'fed_funds' THEN round(latest_value, 2) END)                      AS cash_yield,
        max(CASE WHEN series = 'bond_10y'  THEN round(latest_value, 2) END)                      AS bond_yield,
        max(CASE WHEN series = 'corp_baa'  THEN round(latest_value, 2) END)                      AS credit_yield
    FROM metrics
)
SELECT
    *,
    round(capacity_utilization - capacity_longrun_avg, 1) AS capacity_gap,
    round(bond_yield   - cash_yield, 2)                   AS bond_over_cash,
    round(credit_yield - bond_yield, 2)                   AS credit_over_bond,
    CASE
        WHEN cash_yield IS NULL OR bond_yield IS NULL OR credit_yield IS NULL THEN 'unknown'
        WHEN bond_yield > cash_yield AND credit_yield > bond_yield           THEN 'upward_sloping'
        ELSE 'inverted'
    END AS stack_shape
FROM wide
