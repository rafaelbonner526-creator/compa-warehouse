-- Dalio-style regime: growth (industrial production YoY) x inflation (CPI YoY).
--
-- Emits two readings of the same pair:
--   quadrant  -- LEVEL based (is growth positive, is inflation hot). The
--                headline label.
--   aw_box    -- DIRECTION based (is growth/inflation rising or falling vs 3
--                months ago). This is the All Weather framing: the boxes are
--                about change against expectations, not absolute level. Keys
--                match mart_all_weather.box.
--
-- Thresholds are canonical here and nowhere else. Any surface that displays a
-- regime consumes this model; it must not re-derive the label (the /admin
-- scoring-drift lesson).
--   growth  > 0.5%  -- industrial production YoY above roughly flat
--   inflation > 2.5% -- the Fed's 2% target plus a tolerance band
WITH obs AS (
    SELECT series, obs_date, value
    FROM {{ ref('stg_fred') }}
    WHERE value IS NOT NULL AND series IN ('industrial_production', 'cpi')
),
p0 AS (
    SELECT series, value AS v, obs_date AS ld
    FROM obs
    QUALIFY row_number() OVER (PARTITION BY series ORDER BY obs_date DESC) = 1
),
p3 AS (
    SELECT o.series, o.value AS v
    FROM obs o JOIN p0 l ON o.series = l.series
    WHERE o.obs_date <= cast({{ dbt.dateadd('month', -3, 'l.ld') }} as date)
    QUALIFY row_number() OVER (PARTITION BY o.series ORDER BY o.obs_date DESC) = 1
),
p12 AS (
    SELECT o.series, o.value AS v
    FROM obs o JOIN p0 l ON o.series = l.series
    WHERE o.obs_date <= cast({{ dbt.dateadd('month', -12, 'l.ld') }} as date)
    QUALIFY row_number() OVER (PARTITION BY o.series ORDER BY o.obs_date DESC) = 1
),
p15 AS (
    SELECT o.series, o.value AS v
    FROM obs o JOIN p0 l ON o.series = l.series
    WHERE o.obs_date <= cast({{ dbt.dateadd('month', -15, 'l.ld') }} as date)
    QUALIFY row_number() OVER (PARTITION BY o.series ORDER BY o.obs_date DESC) = 1
),
yoy AS (
    SELECT
        p0.series,
        round(100 * (p0.v - p12.v) / nullif(p12.v, 0), 1) AS yoy_now,
        round(100 * (p3.v - p15.v) / nullif(p15.v, 0), 1) AS yoy_3m_ago
    FROM p0
    LEFT JOIN p3  ON p0.series = p3.series
    LEFT JOIN p12 ON p0.series = p12.series
    LEFT JOIN p15 ON p0.series = p15.series
),
vals AS (
    SELECT
        (SELECT yoy_now    FROM yoy WHERE series = 'industrial_production') AS growth_yoy,
        (SELECT yoy_3m_ago FROM yoy WHERE series = 'industrial_production') AS growth_yoy_3m_ago,
        (SELECT yoy_now    FROM yoy WHERE series = 'cpi')                   AS inflation_yoy,
        (SELECT yoy_3m_ago FROM yoy WHERE series = 'cpi')                   AS inflation_yoy_3m_ago
),
dirs AS (
    SELECT
        *,
        CASE WHEN growth_yoy IS NULL OR growth_yoy_3m_ago IS NULL THEN 'unknown'
             WHEN growth_yoy >= growth_yoy_3m_ago THEN 'rising' ELSE 'falling' END       AS growth_direction,
        CASE WHEN inflation_yoy IS NULL OR inflation_yoy_3m_ago IS NULL THEN 'unknown'
             WHEN inflation_yoy >= inflation_yoy_3m_ago THEN 'rising' ELSE 'falling' END AS inflation_direction
    FROM vals
)
SELECT
    *,
    CASE
        WHEN growth_yoy IS NULL OR inflation_yoy IS NULL THEN 'Unknown'
        WHEN growth_yoy > 0.5 AND inflation_yoy > 2.5 THEN 'Reflation / late-cycle'
        WHEN growth_yoy > 0.5                          THEN 'Goldilocks / expansion'
        WHEN inflation_yoy > 2.5                       THEN 'Stagflation'
        ELSE 'Deflation / slowdown'
    END AS quadrant,
    CASE
        WHEN growth_direction = 'unknown' OR inflation_direction = 'unknown' THEN 'unknown'
        ELSE growth_direction || '_growth_' || inflation_direction || '_inflation'
    END AS aw_box
FROM dirs
