-- Where the world's economies sit on Dalio's long-term debt cycle, on identical terms.
--
-- WHY: mart_big_cycle scores the United States and nothing else. Dalio's claim is
-- not about one country's debt level, it is about the RELATIVE position of powers
-- and the handoff between them, which needs a panel.
--
-- SOURCE CHANGED 2026-09-02, JST -> IMF Historical Public Debt Database.
-- JST was the first build here and it could not answer the question:
--     JST   18 advanced economies, 1870-2020, no China, no Russia
--     IMF   151 economies, 1800-2024, China from 1984, Russia from 1885
-- A framework about rising and falling powers that cannot see the rival is missing
-- the point. JST is still the right source for credit and house prices, where its
-- series are richer; it is simply the wrong one for this question.
--
-- UNITS: IMF indicator "d" is ALREADY a percentage (USA 2024 = 122.3). JST stored a
-- ratio and had to be scaled by 100, which this model got wrong on first build.
-- Do not add a multiplier here. See the panel-level guard in tests/.
--
-- HISTORY DEPTH IS WILDLY UNEVEN AND THAT IS THE INTERESTING PART. The UK has 225
-- years on record and sat at 176% in 1800 after the Napoleonic wars. The
-- Netherlands has 205 and was at 142% in 1814. China has 35. A percentile of "own
-- history" therefore means something very different per country, so years_on_record
-- is emitted on every row rather than left for the reader to assume.
WITH stages AS (
    SELECT * FROM {{ ref('int_big_cycle_stages') }} WHERE stage_order < 6
),
debt AS (
    SELECT entity, year, value AS debt_to_gdp
    FROM {{ ref('stg_lh_imf_debt') }}
    WHERE series = 'public_debt_to_gdp'
      AND value IS NOT NULL
      AND value >= 0
),
latest AS (
    SELECT entity, MAX(year) AS latest_year FROM debt GROUP BY entity
),
cur AS (
    SELECT d.entity, d.year AS as_of_year, d.debt_to_gdp
    FROM debt d JOIN latest l ON l.entity = d.entity AND l.latest_year = d.year
),
traj AS (
    SELECT
        c.entity, c.as_of_year, c.debt_to_gdp,
        c.debt_to_gdp - p1.debt_to_gdp AS chg_1y,
        c.debt_to_gdp - p5.debt_to_gdp AS chg_5y
    FROM cur c
    LEFT JOIN debt p1 ON p1.entity = c.entity AND p1.year = c.as_of_year - 1
    LEFT JOIN debt p5 ON p5.entity = c.entity AND p5.year = c.as_of_year - 5
),
pct AS (
    SELECT
        t.entity,
        (SELECT COUNT(*) FROM debt h
          WHERE h.entity = t.entity AND h.debt_to_gdp <= t.debt_to_gdp)
        / NULLIF((SELECT COUNT(*) FROM debt h2 WHERE h2.entity = t.entity), 0) * 100.0
            AS pct_of_own_history,
        (SELECT COUNT(*) FROM debt h3 WHERE h3.entity = t.entity) AS years_on_record,
        (SELECT MIN(year) FROM debt h4 WHERE h4.entity = t.entity) AS history_from
    FROM traj t
),
-- The powers Dalio's arc is actually about, plus the current rivals. Everything
-- else stays in the table; this only marks what a focused view should lead with.
-- UNION ALL rather than UNNEST(ARRAY<STRUCT>). The struct-array form is BigQuery
-- only and fails to parse on DuckDB, which is what CI builds against, so the model
-- built green in prod and broke every CI run. int_big_cycle_stages already uses
-- this form; matching it keeps every model in this project portable across both.
powers AS (
              SELECT 'USA' AS code, 'United States'  AS label
    UNION ALL SELECT 'CHN', 'China'
    UNION ALL SELECT 'RUS', 'Russia'
    UNION ALL SELECT 'GBR', 'United Kingdom'
    UNION ALL SELECT 'NLD', 'Netherlands'
    UNION ALL SELECT 'ESP', 'Spain'
    UNION ALL SELECT 'FRA', 'France'
    UNION ALL SELECT 'DEU', 'Germany'
    UNION ALL SELECT 'JPN', 'Japan'
    UNION ALL SELECT 'IND', 'India'
)
SELECT
    t.entity                       AS country_code,
    COALESCE(p.label, t.entity)    AS country,
    p.code IS NOT NULL             AS is_major_power,
    t.as_of_year,
    ROUND(t.debt_to_gdp, 1)        AS debt_to_gdp,
    ROUND(t.chg_1y, 1)             AS debt_to_gdp_chg_1y,
    ROUND(t.chg_5y, 1)             AS debt_to_gdp_chg_5y,
    ROUND(pc.pct_of_own_history, 0) AS pct_of_own_history,
    pc.years_on_record,
    pc.history_from,
    s.stage_order, s.stage_name, s.description, s.implication,
    CASE
        WHEN t.chg_5y IS NULL THEN 'unknown'
        WHEN t.chg_5y >  10 THEN 'rising fast'
        WHEN t.chg_5y >   2 THEN 'rising'
        WHEN t.chg_5y < -10 THEN 'falling fast'
        WHEN t.chg_5y <  -2 THEN 'falling'
        ELSE 'flat'
    END AS trajectory,
    RANK() OVER (ORDER BY t.debt_to_gdp DESC) AS debt_rank
FROM traj t
JOIN pct pc ON pc.entity = t.entity
LEFT JOIN powers p ON p.code = t.entity
JOIN stages s ON t.debt_to_gdp >= s.debt_min AND t.debt_to_gdp < s.debt_max
ORDER BY t.debt_to_gdp DESC
