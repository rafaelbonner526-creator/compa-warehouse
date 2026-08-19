-- Dalio stage 4 ("Top of cycle") vs stage 5 ("Decline"): the four criteria, each
-- evaluated separately.
--
-- WHY THIS EXISTS: mart_big_cycle classifies stage from debt-to-GDP alone, which is
-- one indicator carrying a load it cannot bear. Debt/GDP is slow and monotonic, so
-- on its own it can never distinguish "high debt, still the reserve currency,
-- everyone still lends to you" from "high debt AND the world is backing away".
-- Dalio's decline signature is specifically negative real rates + foreign selling +
-- a falling currency. Those are measurable, so they are measured.
--
-- Criteria and thresholds come from the empire-health-monitor skill's own
-- debasement table, not from anything invented here.
--
-- Emitted one row per criterion so the UI can show a split verdict honestly rather
-- than a single confident-looking label.
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
m AS (
    SELECT l.series, l.lv, l.ld, y.yv,
           round(100 * (l.lv - y.yv) / nullif(abs(y.yv), 0), 1) AS chg_1y_pct
    FROM latest l LEFT JOIN yrago y ON l.series = y.series
),
crit AS (
    SELECT 1 AS criterion_order,
           'Debt above 130% of GDP'          AS criterion,
           'debt_to_gdp'                      AS series,
           'Dalio puts the decline stage past 130%. Below that, high debt on its own is not decline.' AS explanation
    UNION ALL SELECT 2, 'Real interest rates negative', 'real_rate_10y',
           'The clearest debasement tell. Negative real rates mean lenders are being paid back in money worth less than they lent.'
    UNION ALL SELECT 3, 'Foreign investors selling Treasuries', 'foreign_treasury',
           'Decline means the world stops funding you. Rising foreign holdings mean the opposite.'
    UNION ALL SELECT 4, 'Dollar in a falling trend', 'dollar_index',
           'A sustained slide in the trade-weighted dollar is the price of losing reserve-currency pull.'
)
SELECT
    c.criterion_order,
    c.criterion,
    c.explanation,
    round(m.lv, 2)   AS latest_value,
    m.ld             AS latest_date,
    m.chg_1y_pct,
    CASE c.series
        WHEN 'debt_to_gdp'      THEN m.lv > 130.0
        WHEN 'real_rate_10y'    THEN m.lv < 0.0
        WHEN 'foreign_treasury' THEN m.chg_1y_pct < 0.0
        WHEN 'dollar_index'     THEN m.chg_1y_pct < 0.0
    END AS points_to_decline,
    CASE c.series
        WHEN 'debt_to_gdp'      THEN 'percent of GDP'
        WHEN 'real_rate_10y'    THEN 'percent, 10y TIPS yield'
        WHEN 'foreign_treasury' THEN '$B held by foreign investors'
        WHEN 'dollar_index'     THEN 'broad trade-weighted index'
    END AS unit
FROM crit c
LEFT JOIN m ON m.series = c.series
ORDER BY c.criterion_order
