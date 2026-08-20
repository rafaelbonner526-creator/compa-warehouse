-- US equity valuation in long-run context (Shiller data, monthly from 1871).
--
-- This is the video's "investor overconfidence" pattern, made measurable. CAPE is
-- price divided by the average of 10 years of inflation-adjusted earnings, so it
-- cannot be flattered by one good year the way a trailing P/E can.
--
-- WHY THE LONG WINDOW IS THE WHOLE POINT: against 20 years of history a CAPE in
-- the mid-30s reads as "somewhat high", because the last 20 years contain the
-- dot-com hangover and the post-2009 re-rating. Against 144 years it sits above
-- the 1929 peak. Same number, opposite meaning. Every percentile here is computed
-- over the full available history for exactly that reason.
--
-- CAVEAT recorded in the output: Shiller's file is revised periodically and the
-- mirror we pull can lag by months, so as_of_year/as_of_month travel with the
-- value and the UI shows them. This is a slow structural signal, so a few months
-- of lag does not change its reading, but a stale number presented as current
-- would be a lie.
-- CTE is NOT named `cape`: BigQuery lets a table name stand for its row struct, so
-- `ORDER BY cape` inside `FROM cape` resolves to the whole row and fails with
-- "Ordering by expressions of type STRUCT". DuckDB resolves it to the column and
-- compiles fine, so this only breaks on one of the two targets.
WITH cape_hist AS (
    SELECT year, period AS month, value AS cape
    FROM {{ ref('stg_lh_shiller') }}
    WHERE series = 'cape' AND value IS NOT NULL
),
ranked AS (
    SELECT
        year, month, cape,
        percent_rank() OVER (ORDER BY cape)                AS pctile,
        row_number()   OVER (ORDER BY year DESC, month DESC) AS rn,
        count(*)       OVER ()                             AS n_obs,
        min(year)      OVER ()                             AS since_year
    FROM cape_hist
),
stats AS (
    SELECT
        round(avg(cape), 1)                     AS mean_cape,
        round(max(cape), 1)                     AS max_cape,
        min(CASE WHEN pr >= 0.50 THEN cape END) AS median_cape
    FROM (SELECT cape, percent_rank() OVER (ORDER BY cape) AS pr FROM cape_hist) q
)
SELECT
    round(r.cape, 1)            AS cape,
    round(100 * r.pctile, 0)    AS percentile,
    r.year                      AS as_of_year,
    r.month                     AS as_of_month,
    r.n_obs,
    r.since_year,
    s.mean_cape,
    round(s.median_cape, 1) AS median_cape,
    s.max_cape,
    CASE
        WHEN r.pctile >= 0.90 THEN 'extreme'
        WHEN r.pctile >= 0.70 THEN 'elevated'
        WHEN r.pctile >= 0.30 THEN 'normal'
        ELSE 'cheap'
    END AS level
FROM ranked r CROSS JOIN stats s
WHERE r.rn = 1
