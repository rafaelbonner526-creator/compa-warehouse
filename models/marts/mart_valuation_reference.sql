-- Named CAPE reference points, one row each.
--
-- Kept as its own model rather than a JSON blob inside mart_valuation: DuckDB and
-- BigQuery disagree on JSON aggregate syntax, and rows are what the UI wants anyway.
--
-- These are the readings a reader already has intuitions about. A percentile is
-- abstract; "higher than 1929" is not.
WITH cape AS (
    SELECT year, period AS month, value AS cape
    FROM {{ ref('stg_lh_shiller') }}
    WHERE series = 'cape' AND value IS NOT NULL
),
points AS (
    SELECT 'Dot-com peak' AS label, 1 AS ord, 1999 AS y, 12 AS m
    UNION ALL SELECT 'Late 2021',           2, 2021, 11
    UNION ALL SELECT '1929 peak',           3, 1929, 8
    UNION ALL SELECT '2007 peak',           4, 2007, 5
    UNION ALL SELECT '1982 low',            5, 1982, 7
)
SELECT p.ord, p.label, p.y AS year, round(c.cape, 1) AS cape
FROM points p
JOIN cape c ON c.year = p.y AND c.month = p.m
ORDER BY p.ord
