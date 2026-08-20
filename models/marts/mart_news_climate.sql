-- News-derived climate: how uncertain and stressed the world reads right now.
--
-- Two of these are literally built by counting newspaper coverage (Baker, Bloom &
-- Davis Economic Policy Uncertainty); the other two are the market pricing its own
-- fear. Together they answer "does the news actually matter to markets yet" with
-- numbers instead of vibes, which is the only defensible way to put world news in a
-- portfolio dashboard.
--
-- Every value is expressed as a PERCENTILE of its OWN FULL history, because a raw
-- VIX of 15 or an EPU of 182 is meaningless without knowing where it sits. The
-- windows differ by series and that is deliberate: these indices simply started at
-- different times (EPU 1985, VIX 1990, stress index 1993) and truncating them all
-- to a common recent window would make every percentile a claim about the wrong
-- distribution. since_date travels with each row so the UI can state the window.
--
-- Deliberately NOT a trading input. It sits at the Big Cycle's cadence.
WITH obs AS (
    SELECT series, obs_date, value
    FROM {{ ref('stg_fred') }}
    WHERE value IS NOT NULL
      AND series IN ('policy_uncertainty', 'global_policy_uncertainty',
                     'financial_stress', 'vix', 'recession_prob')
),
ranked AS (
    SELECT
        series,
        obs_date,
        value,
        percent_rank() OVER (PARTITION BY series ORDER BY value) AS pctile,
        row_number()   OVER (PARTITION BY series ORDER BY obs_date DESC) AS rn,
        count(*)       OVER (PARTITION BY series) AS n_obs,
        min(obs_date)  OVER (PARTITION BY series) AS since_date
    FROM obs
),
labels AS (
    SELECT 'policy_uncertainty' AS series, 1 AS ord,
           'US policy uncertainty' AS label,
           'Counts newspaper articles about economic policy uncertainty. High means the press is full of it.' AS explanation
    UNION ALL SELECT 'global_policy_uncertainty', 2, 'Global policy uncertainty',
           'The same newspaper-count method applied across major economies.'
    UNION ALL SELECT 'financial_stress', 3, 'Financial stress',
           'St. Louis Fed index of 18 market indicators. Zero is normal; negative means calmer than average.'
    UNION ALL SELECT 'vix', 4, 'Equity volatility (VIX)',
           'What options markets charge for protection. The market pricing its own fear, in real money.'
    UNION ALL SELECT 'recession_prob', 5, 'Recession probability',
           'Smoothed model probability that the economy is currently in recession.'
)
SELECT
    l.ord,
    l.label,
    l.explanation,
    r.series,
    round(r.value, 2)          AS latest_value,
    r.obs_date                 AS latest_date,
    round(100 * r.pctile, 0)   AS percentile,
    r.n_obs,
    r.since_date,
    CASE
        WHEN r.pctile >= 0.90 THEN 'extreme'
        WHEN r.pctile >= 0.70 THEN 'elevated'
        WHEN r.pctile >= 0.30 THEN 'normal'
        ELSE 'calm'
    END AS level
FROM ranked r
JOIN labels l ON l.series = r.series
WHERE r.rn = 1
ORDER BY l.ord
