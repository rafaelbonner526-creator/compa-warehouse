-- Debt buildup in long-run context: the video's fourth crash pattern, and the one
-- of the four that is genuinely measurable.
--
-- Two distinct debts, often confused:
--   private credit / GDP  -- bank lending to households and firms (JST tloans)
--   public debt / GDP     -- government borrowing (JST debtgdp)
-- Crashes driven by private credit (1929, 2008) look different from sovereign debt
-- crises, so they are never summed here.
--
-- WHAT LEVEL AND WHAT CHANGE: the level says how much debt exists; the CHANGE says
-- whether a boom is underway. The BIS early-warning literature is clear that rapid
-- growth in credit/GDP predicts trouble better than a high level does, because a
-- high but stable ratio is an economy that has adjusted to its debt. Both are
-- emitted; the UI leads with the 5-year change.
--
-- Percentile is over the country's own full history (1870-2020), not a global pool,
-- because credit/GDP norms differ enormously across countries and eras.
WITH loans AS (
    SELECT entity, year, value AS tloans
    FROM {{ ref('stg_lh_jst') }}
    WHERE series = 'total_loans' AND value IS NOT NULL
),
gdp AS (
    SELECT entity, year, value AS gdp
    FROM {{ ref('stg_lh_jst') }}
    WHERE series = 'nominal_gdp' AND value IS NOT NULL AND value > 0
),
pub AS (
    SELECT entity, year, value AS pub_debt_gdp
    FROM {{ ref('stg_lh_jst') }}
    WHERE series = 'public_debt_to_gdp' AND value IS NOT NULL
),
joined AS (
    SELECT
        l.entity,
        l.year,
        100 * l.tloans / g.gdp     AS credit_to_gdp,
        100 * p.pub_debt_gdp       AS public_debt_to_gdp
    FROM loans l
    JOIN gdp g ON l.entity = g.entity AND l.year = g.year
    LEFT JOIN pub p ON l.entity = p.entity AND l.year = p.year
),
withlag AS (
    SELECT
        *,
        lag(credit_to_gdp, 5) OVER (PARTITION BY entity ORDER BY year) AS credit_5y_ago,
        percent_rank() OVER (PARTITION BY entity ORDER BY credit_to_gdp) AS credit_pctile,
        row_number() OVER (PARTITION BY entity ORDER BY year DESC)      AS rn,
        count(*)     OVER (PARTITION BY entity)                          AS n_obs,
        min(year)    OVER (PARTITION BY entity)                          AS since_year,
        max(year)    OVER (PARTITION BY entity)                          AS until_year
    FROM joined
)
SELECT
    entity,
    year                                              AS as_of_year,
    round(credit_to_gdp, 1)                           AS credit_to_gdp,
    round(credit_to_gdp - credit_5y_ago, 1)           AS credit_change_5y,
    round(100 * credit_pctile, 0)                     AS credit_percentile,
    round(public_debt_to_gdp, 1)                      AS public_debt_to_gdp,
    n_obs,
    since_year,
    until_year,
    CASE
        WHEN credit_pctile >= 0.90 THEN 'extreme'
        WHEN credit_pctile >= 0.70 THEN 'elevated'
        WHEN credit_pctile >= 0.30 THEN 'normal'
        ELSE 'low'
    END AS level,
    -- BIS-style boom flag. 10pp of credit/GDP growth in 5 years is the widely
    -- cited threshold above which credit expansions have historically preceded
    -- banking distress. Reported, never enforced.
    CASE
        WHEN credit_to_gdp - credit_5y_ago IS NULL THEN 'unknown'
        WHEN credit_to_gdp - credit_5y_ago >= 10.0 THEN 'boom'
        WHEN credit_to_gdp - credit_5y_ago <= -10.0 THEN 'deleveraging'
        ELSE 'stable'
    END AS credit_trend
FROM withlag
WHERE rn = 1
ORDER BY entity
