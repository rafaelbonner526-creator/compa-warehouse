-- latest value + 90-day change/direction per FRED series (5-indicator panel)
WITH obs AS (
    SELECT series, obs_date, value FROM {{ ref('stg_fred') }} WHERE value IS NOT NULL
),
latest AS (
    SELECT series, value AS latest_value, obs_date AS latest_date
    FROM obs
    QUALIFY row_number() OVER (PARTITION BY series ORDER BY obs_date DESC) = 1
),
prior AS (
    SELECT o.series, o.value AS prior_value
    FROM obs o
    JOIN latest l ON o.series = l.series
    WHERE o.obs_date <= cast({{ dbt.dateadd('day', -90, 'l.latest_date') }} as date)
    QUALIFY row_number() OVER (PARTITION BY o.series ORDER BY o.obs_date DESC) = 1
)
SELECT
    l.series,
    round(l.latest_value, 2)                                            AS latest_value,
    l.latest_date,
    round(l.latest_value - p.prior_value, 2)                            AS change_90d,
    round(100 * (l.latest_value - p.prior_value) / nullif(p.prior_value, 0), 1) AS change_90d_pct,
    CASE
        WHEN l.latest_value > p.prior_value THEN 'up'
        WHEN l.latest_value < p.prior_value THEN 'down'
        ELSE 'flat'
    END AS direction
FROM latest l
LEFT JOIN prior p ON l.series = p.series
