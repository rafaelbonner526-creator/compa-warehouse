-- Live US/International equity split against BOTH governing bands.
--
--   ALTO band          -- 50-55% US of equity. Tightened from 50-65% on 2026-08-18.
--   Evidence zone      -- 11-55% domestic, the region Cederburg et al. measure as
--                         costing under 10.50% equivalent savings rate vs the
--                         10.00% optimum. 55% is the ceiling; 65% was never inside it.
--
-- Emitted per scope (Active, Roth, Combined) so the narrow band can be judged where
-- it actually applies rather than on a blended number.
WITH eq AS (
    SELECT account, region, market_value
    FROM {{ ref('stg_holdings') }}
    WHERE asset_class = 'equity' AND market_value IS NOT NULL
),
scoped AS (
    SELECT 'Active' AS scope, 1 AS scope_order, region, market_value FROM eq WHERE account LIKE 'Active Investing%'
    UNION ALL
    SELECT 'Roth',   2, region, market_value FROM eq WHERE account LIKE 'ROTH%'
    UNION ALL
    SELECT 'Combined', 3, region, market_value FROM eq
),
agg AS (
    SELECT
        scope,
        scope_order,
        sum(market_value)                                          AS equity_value,
        sum(CASE WHEN region = 'US' THEN market_value ELSE 0 END)  AS us_value
    FROM scoped
    GROUP BY scope, scope_order
),
pct AS (
    SELECT
        scope,
        scope_order,
        round(equity_value)                                              AS equity_value,
        round(100 * us_value / nullif(equity_value, 0), 1)               AS us_pct,
        round(100 * (equity_value - us_value) / nullif(equity_value, 0), 1) AS intl_pct
    FROM agg
    WHERE equity_value > 0
)
SELECT
    *,
    50.0 AS band_min,
    55.0 AS band_max,
    11.0 AS evidence_min,
    55.0 AS evidence_max,
    us_pct >= 50.0 AND us_pct <= 55.0 AS in_alto_band,
    us_pct >= 11.0 AND us_pct <= 55.0 AS in_evidence_zone,
    round(us_pct - 55.0, 1)           AS pct_over_ceiling
FROM pct
ORDER BY scope_order
