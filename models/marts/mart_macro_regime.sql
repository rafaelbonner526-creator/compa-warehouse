-- Dalio-style regime inputs: growth (industrial production YoY) x inflation (CPI YoY)
WITH obs AS (
    SELECT series, obs_date, value
    FROM {{ ref('stg_fred') }}
    WHERE value IS NOT NULL AND series IN ('industrial_production', 'cpi')
),
latest AS (
    SELECT series, value AS lv, obs_date AS ld
    FROM obs
    QUALIFY row_number() OVER (PARTITION BY series ORDER BY obs_date DESC) = 1
),
yrago AS (
    SELECT o.series, o.value AS yv
    FROM obs o
    JOIN latest l ON o.series = l.series
    WHERE o.obs_date <= cast({{ dbt.dateadd('month', -12, 'l.ld') }} as date)
    QUALIFY row_number() OVER (PARTITION BY o.series ORDER BY o.obs_date DESC) = 1
),
yoy_vals AS (
    SELECT l.series AS s, round(100 * (l.lv - y.yv) / nullif(y.yv, 0), 1) AS yoy
    FROM latest l JOIN yrago y ON l.series = y.series
)
SELECT
    (SELECT yoy FROM yoy_vals WHERE s = 'industrial_production') AS growth_yoy,
    (SELECT yoy FROM yoy_vals WHERE s = 'cpi')                   AS inflation_yoy
