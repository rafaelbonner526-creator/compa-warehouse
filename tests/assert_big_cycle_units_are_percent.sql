-- Fails if debt-to-GDP looks like a raw JST ratio instead of a percentage.
--
-- Origin 2026-09-02: mart_big_cycle_comparative read the JST debtgdp series raw.
-- Japan came out at 2.5 instead of 254, and ALL 18 countries were classified into
-- stage 1, "New world order", the single most flattering stage in the model. The
-- dbt build passed. Only reading the numbers caught it.
--
-- No modern advanced economy has public debt below 5% of GDP. A value under 5 for a
-- post-1945 observation means the ratio came through unscaled.
SELECT entity, as_of_year, debt_to_gdp
FROM {{ ref('mart_big_cycle_comparative') }}
WHERE as_of_year >= 1945 AND debt_to_gdp < 5
