-- 18-year property cycle position (Fred Harrison / Phil Anderson, building on
-- Homer Hoyt's land-value work).
--
-- ATTRIBUTION: this is NOT a Warren Buffett model. Buffett has no cycle model.
-- It is a heterodox framework with a small number of observed cycles, so it is a
-- MODEL OVERLAY on real price data, never a forecast. The UI must label it as
-- contested.
--
-- What is measured vs what is modeled:
--   measured  -- the trough date and years elapsed, derived from Case-Shiller
--                (CSUSHPINSA) over the ~20 years extract_fred pulls
--   modeled   -- the 18-year length and the phase boundaries below
--
-- The trough is located as the minimum of the series in the window. trough_at_edge
-- flags the case where the minimum sits at the very start of the available data,
-- which means we may be looking at a window boundary rather than a real trough.
WITH h AS (
    SELECT obs_date, value
    FROM {{ ref('stg_fred') }}
    WHERE series = 'house_prices' AND value IS NOT NULL
),
bounds AS (SELECT min(obs_date) AS first_date, max(obs_date) AS last_date FROM h),
trough AS (
    SELECT obs_date AS trough_date, value AS trough_value
    FROM h
    QUALIFY row_number() OVER (ORDER BY value ASC, obs_date ASC) = 1
),
peak_since AS (
    SELECT max(h.value) AS peak_value
    FROM h CROSS JOIN trough t
    WHERE h.obs_date >= t.trough_date
),
pos AS (
    SELECT
        t.trough_date,
        b.last_date,
        b.first_date,
        round({{ dbt.datediff('t.trough_date', 'b.last_date', 'day') }} / 365.25, 1) AS years_since_trough,
        round(100 * (p.peak_value - t.trough_value) / nullif(t.trough_value, 0), 1)  AS pct_off_trough,
        t.trough_date = b.first_date                                                 AS trough_at_edge
    FROM trough t CROSS JOIN bounds b CROSS JOIN peak_since p
)
SELECT
    *,
    18.0 AS cycle_length_years,
    round(100 * years_since_trough / 18.0, 1) AS cycle_pct_complete,
    CASE
        WHEN years_since_trough IS NULL  THEN 'unknown'
        WHEN years_since_trough <  7.0   THEN 'Recovery'
        WHEN years_since_trough <  9.0   THEN 'Mid-cycle slowdown'
        WHEN years_since_trough < 14.0   THEN 'Expansion'
        WHEN years_since_trough < 16.0   THEN 'Mania / peak'
        WHEN years_since_trough < 18.0   THEN 'Downturn'
        ELSE 'Past model horizon (new cycle unconfirmed)'
    END AS phase
FROM pos
