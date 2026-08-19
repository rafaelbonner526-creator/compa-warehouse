-- All Weather 4-box coverage (Dalio: hold something that wins in each of the
-- four growth x inflation environments).
--
-- covering_pct = share of TOTAL portfolio value sitting in assets that
-- historically win in that box. Boxes deliberately double-count gold: it is the
-- hedge for both inflationary boxes, so it covers each of them.
--
-- Mapping is intentionally strict about what counts as diversification.
-- International equity (VYMI) is counted as equity, NOT as an inflation hedge,
-- because it is ~0.6 correlated with the rest of the equity book. Counting it
-- twice would paint coverage the portfolio does not actually have.
--
-- coverage label:
--   none    = 0% (nothing in this box)
--   thin    = under 6.25%, a quarter of the 25% an equal-risk 4-box split
--             implies, i.e. too small to move the portfolio
--   covered = at or above that
--
-- by_design: the falling-growth/falling-inflation box is deliberately left thin.
-- Covering it properly needs long treasuries, and the governing thesis holds zero
-- bonds on Cederburg et al. evidence (bonds cost 9.44pp of equivalent savings rate
-- at this horizon, and All Weather only works on bonds you can lever, which is not
-- available in a brokerage or a Roth). Without this flag the dashboard would report
-- a permanent deficiency and nag toward a position the thesis explicitly rejects.
-- See personal vault: wiki/investing/synthesis-evidence-vs-cycles.md
WITH boxes AS (
    SELECT 'rising_growth_falling_inflation'  AS box, 1 AS box_order,
           'Growth up, inflation down'        AS box_label,
           'rising'  AS growth, 'falling' AS inflation,
           'Equities, corporate credit'       AS wins
    UNION ALL SELECT 'rising_growth_rising_inflation',   2,
           'Growth up, inflation up',   'rising',  'rising',
           'Commodities, gold, inflation-linked bonds'
    UNION ALL SELECT 'falling_growth_falling_inflation', 3,
           'Growth down, inflation down', 'falling', 'falling',
           'Long treasuries, cash'
    UNION ALL SELECT 'falling_growth_rising_inflation',  4,
           'Growth down, inflation up', 'falling', 'rising',
           'Gold, commodities, inflation-linked bonds'
),
h AS (SELECT asset_class, market_value FROM {{ ref('stg_holdings') }}),
tot AS (SELECT sum(market_value) AS t FROM h),
cover AS (
    SELECT 'rising_growth_falling_inflation' AS box, coalesce(sum(market_value), 0) AS v
    FROM h WHERE asset_class = 'equity'
    UNION ALL
    SELECT 'rising_growth_rising_inflation', coalesce(sum(market_value), 0)
    FROM h WHERE asset_class = 'commodity'
    UNION ALL
    SELECT 'falling_growth_falling_inflation', coalesce(sum(market_value), 0)
    FROM h WHERE asset_class IN ('bond', 'cash')
    UNION ALL
    SELECT 'falling_growth_rising_inflation', coalesce(sum(market_value), 0)
    FROM h WHERE asset_class = 'commodity'
)
SELECT
    b.box,
    b.box_order,
    b.box_label,
    b.growth,
    b.inflation,
    b.wins,
    round(c.v)                                  AS covering_value,
    round(100 * c.v / nullif(t.t, 0), 1)        AS covering_pct,
    CASE
        WHEN t.t IS NULL THEN 'unknown'
        WHEN c.v = 0 THEN 'none'
        WHEN 100 * c.v / t.t < 6.25 THEN 'thin'
        ELSE 'covered'
    END                                         AS coverage,
    b.box = 'falling_growth_falling_inflation'  AS by_design,
    CASE
        WHEN b.box = 'falling_growth_falling_inflation'
        THEN 'Uncovered on purpose. Covering this box needs long treasuries; the thesis holds zero bonds on Cederburg evidence at this horizon.'
        ELSE NULL
    END                                         AS by_design_reason
FROM boxes b
JOIN cover c ON b.box = c.box
CROSS JOIN tot t
ORDER BY b.box_order
