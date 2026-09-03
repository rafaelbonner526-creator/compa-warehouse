-- Pins two well-established historical figures so a broken denominator is caught.
--
-- ORIGIN 2026-09-02: mart_world_power first computed share-of-world by SUMMING
-- whichever countries reported in a given year. Maddison coverage is sparse AND
-- non-monotonic (55 countries in 1820, 17 in 1830, 67 in 1870, 44 in 1900), so thin
-- years collapsed the denominator and inflated every share. It put the United
-- Kingdom at 25.3% of world GDP in 1845 and made nearly every power peak in the
-- 1830s-40s. dbt reported success; the numbers were simply wrong.
--
-- Fixed by using Maddison's OWN published world total. These two anchors are the
-- cheapest way to notice if that ever regresses:
--   UK peak share is ~9% around 1870. Anything above 15% means the denominator broke.
--   US peak share is ~27% around 1950. Anything above 35% means the same.
-- Both are widely cited figures, not numbers invented here.
SELECT country, peak_pct, peak_year
FROM {{ ref('mart_world_power') }}
WHERE (country = 'United Kingdom' AND peak_pct > 15)
   OR (country = 'United States'  AND peak_pct > 35)
GROUP BY country, peak_pct, peak_year
