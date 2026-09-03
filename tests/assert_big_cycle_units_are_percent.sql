-- Fails if debt-to-GDP came through as a raw ratio instead of a percentage.
--
-- ORIGIN 2026-09-02: mart_big_cycle_comparative read the JST debtgdp series raw.
-- Japan came out at 2.5 instead of 254, the USA at 1.3, and ALL 18 countries
-- landed in stage 1 "New world order", the most flattering stage in the model.
-- The dbt build passed. Only reading the numbers caught it.
--
-- FIRST VERSION OF THIS TEST WAS WRONG and would have blocked real data. It
-- flagged any post-1945 observation under 5%, which is fine for JST but fires on
-- China 1984 at 0.97%, a genuine figure from before China issued meaningful public
-- debt. A guard that rejects true observations is worse than no guard, because the
-- fix is to weaken it and then it protects nothing.
--
-- The units bug is a WHOLE-PANEL failure: if the scale is wrong, it is wrong for
-- everyone at once. So the test asks a panel-level question instead of a row-level
-- one. Japan has carried the highest public debt in the developed world for
-- decades and is nowhere near 3% of GDP; if the maximum observation in the most
-- recent year is under 50, the scale broke.
SELECT
    MAX(debt_to_gdp) AS max_debt_in_latest_year
FROM {{ ref('mart_big_cycle_comparative') }}
HAVING MAX(debt_to_gdp) < 50
