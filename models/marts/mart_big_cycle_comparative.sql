-- Where 18 economies sit on Dalio's long-term debt cycle, on identical terms.
--
-- WHY: mart_big_cycle scores the United States and nothing else, while 18 countries
-- of Jordà-Schularick-Taylor data sat loaded and unread since 2026-08-19. Dalio's
-- actual claim is not about one country's debt level, it is about the RELATIVE
-- position of powers and the handoff between them. That question needs a panel.
--
-- SAME FOOTING, ON PURPOSE. Every country is scored as of its own latest year, and
-- the year is emitted on every row. JST ends in 2020 for all 18, so this is a
-- 2020 snapshot, NOT a live one.
--
-- DO NOT COMPARE THESE NUMBERS TO mart_big_cycle. That model reads live FRED data,
-- so its US debt-to-GDP is current. Putting a 2026 US figure beside a 2020 French
-- one and calling it a ranking would be wrong. The two models answer different
-- questions and are deliberately kept apart.
--
-- WHAT IS MISSING AND WHY IT MATTERS: JST covers advanced economies only. China and
-- Russia are absent, which is a real limitation for a framework about rising and
-- falling powers, since the rival is the whole point. Those arrive on a separate
-- source (Maddison, IMF) and will land as additional entities in this same shape.
--
-- Trajectory matters more than level. A country at 95% and falling is in a
-- different situation from one at 95% and climbing 4 points a year, and the stage
-- bands alone cannot tell them apart. Both are emitted.
WITH stages AS (
    SELECT * FROM {{ ref('int_big_cycle_stages') }} WHERE stage_order < 6
),
debt AS (
    -- JST stores debtgdp as a RATIO, not a percentage: Japan 2020 is 2.539, meaning
    -- 254%. Reading it raw put every one of the 18 countries in stage 1 "New world
    -- order" with Japan at 2.5% debt, which is the most flattering possible reading
    -- and completely wrong. mart_credit_cycle already multiplies by 100 for the same
    -- series; this model did not, until 2026-09-02. See the range test in _marts.yml,
    -- which now fails loudly if the raw ratio ever comes through again.
    SELECT entity, year, 100 * value AS debt_to_gdp
    FROM {{ ref('stg_lh_jst') }}
    WHERE series = 'public_debt_to_gdp'
      AND value IS NOT NULL
      AND value >= 0
),
latest AS (
    SELECT entity, MAX(year) AS latest_year
    FROM debt GROUP BY entity
),
cur AS (
    SELECT d.entity, d.year AS as_of_year, d.debt_to_gdp
    FROM debt d JOIN latest l ON l.entity = d.entity AND l.latest_year = d.year
),
-- Trajectory over 1 and 5 years. LEFT JOIN so a country missing a prior year
-- reports NULL rather than silently dropping out of the panel entirely.
traj AS (
    SELECT
        c.entity,
        c.as_of_year,
        c.debt_to_gdp,
        c.debt_to_gdp - p1.debt_to_gdp AS chg_1y,
        c.debt_to_gdp - p5.debt_to_gdp AS chg_5y
    FROM cur c
    LEFT JOIN debt p1 ON p1.entity = c.entity AND p1.year = c.as_of_year - 1
    LEFT JOIN debt p5 ON p5.entity = c.entity AND p5.year = c.as_of_year - 5
),
-- Percentile against the country's OWN history, never a global pool. Debt norms
-- differ enormously across countries and eras, so a cross-country percentile
-- would mostly measure which countries kept better records.
pct AS (
    SELECT
        t.entity,
        (SELECT COUNT(*) FROM debt h
          WHERE h.entity = t.entity AND h.debt_to_gdp <= t.debt_to_gdp)
        / NULLIF((SELECT COUNT(*) FROM debt h2 WHERE h2.entity = t.entity), 0) * 100.0
            AS pct_of_own_history,
        (SELECT COUNT(*) FROM debt h3 WHERE h3.entity = t.entity) AS years_on_record
    FROM traj t
)
SELECT
    t.entity,
    t.as_of_year,
    ROUND(t.debt_to_gdp, 1)  AS debt_to_gdp,
    ROUND(t.chg_1y, 1)       AS debt_to_gdp_chg_1y,
    ROUND(t.chg_5y, 1)       AS debt_to_gdp_chg_5y,
    ROUND(p.pct_of_own_history, 0) AS pct_of_own_history,
    p.years_on_record,
    s.stage_order,
    s.stage_name,
    s.description,
    s.implication,
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
JOIN pct p ON p.entity = t.entity
JOIN stages s
  ON t.debt_to_gdp >= s.debt_min AND t.debt_to_gdp < s.debt_max
ORDER BY t.debt_to_gdp DESC
