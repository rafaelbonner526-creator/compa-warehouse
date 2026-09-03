-- Share of world output, 1500 to 2022. The rise-and-fall picture Dalio's arc is about.
--
-- WHY THIS AND NOT DEBT: mart_big_cycle_comparative answers "how indebted is this
-- country against its own past". It cannot answer "who is ascending and who is
-- being overtaken", because debt levels say nothing about relative size. Share of
-- world GDP is one of Dalio's eight measures of national power and it is the one
-- that most directly shows a handoff.
--
-- SOURCE: Maddison Project 2023, GDP per capita x population, expressed as a
-- percent of world output in the same year. Maddison is the only source here that
-- reaches back far enough to contain the Dutch peak, the British peak and the
-- American peak in one series.
--
-- BENCHMARK YEARS ONLY. Maddison defines a world total at 21 years, mostly decadal
-- before 1950 and annual after. Shares are emitted only where that total exists, so
-- the series is sparse early and dense late. That is the honest shape of the data
-- rather than an interpolation dressed up as observation.
--
-- countries_reporting is still emitted so the reader can see how much of the world
-- was actually measured behind each benchmark.
WITH country_gdp AS (
    SELECT entity, year, value AS gdp
    FROM {{ ref('stg_lh_maddison') }}
    WHERE series = 'gdp_total' AND value IS NOT NULL AND value > 0
),
-- Maddison's OWN world total, not a sum of whoever reported that year.
--
-- The first build here summed reporting countries and gated on >= 15 of them. That
-- was wrong in a way that produced a confident, plausible, false result: Maddison
-- coverage is non-monotonic (55 countries in 1820, 17 in 1830, 67 in 1870, 44 in
-- 1900), so thin years collapse the denominator and inflate every share. It put the
-- United Kingdom at 25.3% of world GDP in 1845, against a real figure nearer 9%,
-- and made nearly every power appear to peak in the 1830s-40s. The dbt build passed.
--
-- Maddison publishes world GDP per capita and world population at 21 benchmark
-- years. Their product is the denominator, and shares exist only where Maddison
-- defines a world. Fewer rows, and the ones that remain are true.
world AS (
    SELECT year, value AS world_gdp
    FROM {{ ref('stg_lh_maddison') }}
    WHERE entity = 'WORLD' AND series = 'gdp_total' AND value > 0
),
coverage AS (
    SELECT year, COUNT(DISTINCT entity) AS countries_reporting
    FROM country_gdp GROUP BY year
),
usable AS (
    SELECT w.year, w.world_gdp, c.countries_reporting
    FROM world w LEFT JOIN coverage c ON c.year = w.year
),
-- UNION ALL rather than UNNEST(...) AS x, which is BigQuery-only syntax and made
-- DuckDB cast the column to STRUCT(unnest VARCHAR), failing the join. See the same
-- note in mart_big_cycle_comparative.
powers AS (
              SELECT 'United States' AS country
    UNION ALL SELECT 'China'
    UNION ALL SELECT 'Russian Federation'
    UNION ALL SELECT 'United Kingdom'
    UNION ALL SELECT 'Netherlands'
    UNION ALL SELECT 'Spain'
    UNION ALL SELECT 'France'
    UNION ALL SELECT 'Germany'
    UNION ALL SELECT 'Japan'
    UNION ALL SELECT 'India'
    UNION ALL SELECT 'Italy'
),
shares AS (
    SELECT
        g.entity AS country,
        g.year,
        100.0 * g.gdp / w.world_gdp AS pct_of_world_gdp,
        w.countries_reporting
    FROM country_gdp g
    JOIN usable w ON w.year = g.year
    JOIN powers p ON p.country = g.entity
)
SELECT
    country,
    year,
    ROUND(pct_of_world_gdp, 2) AS pct_of_world_gdp,
    countries_reporting,
    -- Peak share and the year it happened, so the handoff is legible without the
    -- caller having to compute it. A power past its peak is the whole subject.
    ROUND(MAX(pct_of_world_gdp) OVER (PARTITION BY country), 2) AS peak_pct,
    FIRST_VALUE(year) OVER (
        PARTITION BY country ORDER BY pct_of_world_gdp DESC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) AS peak_year,
    ROUND(
        100.0 * pct_of_world_gdp
        / NULLIF(MAX(pct_of_world_gdp) OVER (PARTITION BY country), 0), 0
    ) AS pct_of_own_peak
FROM shares
ORDER BY country, year
