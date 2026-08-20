-- MEASURED trough-to-trough intervals in real house prices, 18 countries, 1870-2020
-- (Jordà-Schularick-Taylor Macrohistory Database).
--
-- This model exists to replace an assumption with a measurement. The 18-year
-- property cycle (Harrison / Anderson, after Homer Hoyt) was previously asserted
-- on this dashboard from 39 years of Case-Shiller data, a window containing
-- exactly ONE trough. One observation cannot support a claim about periodicity.
-- 151 years across 18 countries contains 85 intervals, which makes the model
-- testable.
--
-- Trough definition: a year whose real house price index is the minimum within a
-- +/- 5 year window, with a full window available on both sides. Consecutive or
-- near-consecutive hits (within 2 years) are collapsed to one trough so a flat
-- bottom counts once rather than five times.
--
-- The +/-5 year half-window is a judgment call and it is the main lever on the
-- result: too small and every wobble is a trough, too large and only depressions
-- register. 5 was chosen as roughly a quarter of the hypothesised 18-year cycle,
-- so a genuine cycle survives it while noise does not.
--
-- Real, not nominal, prices: over 150 years inflation dwarfs the cycle, and a
-- nominal series in a high-inflation decade never makes a trough at all.
WITH hp AS (
    SELECT entity, year, value AS hpnom
    FROM {{ ref('stg_lh_jst') }}
    WHERE series = 'house_prices_nominal' AND value IS NOT NULL
),
cpi AS (
    SELECT entity, year, value AS cpi
    FROM {{ ref('stg_lh_jst') }}
    WHERE series = 'cpi' AND value IS NOT NULL AND value > 0
),
real_hp AS (
    SELECT h.entity, h.year, h.hpnom / c.cpi AS rhp
    FROM hp h JOIN cpi c ON h.entity = c.entity AND h.year = c.year
),
windowed AS (
    SELECT
        entity,
        year,
        rhp,
        min(rhp) OVER (
            PARTITION BY entity ORDER BY year
            ROWS BETWEEN 5 PRECEDING AND 5 FOLLOWING
        ) AS win_min,
        count(*) OVER (
            PARTITION BY entity ORDER BY year
            ROWS BETWEEN 5 PRECEDING AND 5 FOLLOWING
        ) AS win_n
    FROM real_hp
),
-- win_n = 11 guarantees a full window on both sides, so series edges cannot
-- masquerade as troughs (the same failure mode trough_at_edge guards downstream).
hits AS (
    SELECT entity, year
    FROM windowed
    WHERE rhp = win_min AND win_n = 11
),
-- collapse runs: keep a hit only when the previous hit is more than 2 years back
collapsed AS (
    SELECT
        entity,
        year,
        lag(year) OVER (PARTITION BY entity ORDER BY year) AS prev_hit
    FROM hits
),
troughs AS (
    SELECT entity, year AS trough_year
    FROM collapsed
    WHERE prev_hit IS NULL OR year - prev_hit > 2
)
SELECT
    entity,
    trough_year,
    lag(trough_year) OVER (PARTITION BY entity ORDER BY trough_year) AS prev_trough_year,
    trough_year - lag(trough_year) OVER (PARTITION BY entity ORDER BY trough_year) AS interval_years
FROM troughs
ORDER BY entity, trough_year
