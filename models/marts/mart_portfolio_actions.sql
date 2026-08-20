-- Ranked, concrete portfolio actions derived from the documented thesis rules.
--
-- WHY: the Portfolio tab reported metrics but never said what to DO about them,
-- and the metric it showed for the US band was the COMBINED all-account figure
-- (54.0%) while the band it was implicitly judged against is the ACTIVE-account
-- band. Two different numbers wearing one label. Every check here consumes
-- mart_evidence_bands for scope-correct percentages so the tab and the Market tab
-- can never disagree.
--
-- Rules encoded, all from wiki/investing/src-investing-thesis.md:
--   US band 50-55% of Active equity (tightened from 50-65% on 2026-08-18)
--   International 45-50%, and deployment rule 1 sends everything to intl below 45%
--   5-7 standard positions while Active < $15K
--   Standard cap 7%, conviction cap 12% while Active < $15K
--   Defensive sleeve 25-35%, inflation hedge 0-5%, dry powder 0-15%, bonds 0%
--   HSA invests once cash reaches $2,000
--   Emergency fund >= 3 months of expenses
--
-- Severity: 1 = act now, 2 = act at the next quarterly rebalance, 3 = watch.
-- Rows resolve to 'ok' rather than disappearing, so a passing rule is visibly
-- passing instead of silently absent. "No findings" and "not checked" must not
-- look the same.
WITH bands AS (
    SELECT us_pct, intl_pct, band_min, band_max, equity_value
    FROM {{ ref('mart_evidence_bands') }} WHERE scope = 'Active'
),
pos AS (
    SELECT
        sum(CASE WHEN sleeve = 'standard' THEN 1 ELSE 0 END)                  AS n_standard,
        sum(CASE WHEN over_cap THEN 1 ELSE 0 END)                             AS n_over_cap,
        sum(CASE WHEN sleeve = 'defensive'       THEN pct_of_active ELSE 0 END) AS defensive_pct,
        sum(CASE WHEN sleeve = 'inflation_hedge' THEN pct_of_active ELSE 0 END) AS hedge_pct,
        sum(CASE WHEN sleeve = 'dry_powder'      THEN pct_of_active ELSE 0 END) AS powder_pct,
        sum(value)                                                            AS active_total
    FROM {{ ref('mart_positions') }}
),
hsa AS (
    SELECT
        coalesce(sum(CASE WHEN account LIKE 'Wex Health HSA%' THEN current_balance END), 0)                AS hsa_cash,
        coalesce(sum(CASE WHEN account LIKE 'Wex Health Investment%' THEN current_balance END), 0)         AS hsa_invested
    FROM {{ ref('stg_accounts') }}
),
cash AS (
    SELECT coalesce(sum(current_balance), 0) AS liquid
    FROM {{ ref('stg_accounts') }} WHERE account_type = 'Cash' AND is_asset
),
burn AS (SELECT avg_monthly_spend AS monthly_spend FROM {{ ref('mart_safe_to_spend') }}),
checks AS (
    SELECT 1 AS severity, 'HSA' AS area,
        'Invest the HSA' AS title,
        'Cash has crossed the $2,000 threshold and the investment account is empty. Mirror the Roth at 55/45.' AS detail,
        h.hsa_cash AS current_value, 2000.0 AS target_value, '$' AS unit,
        CASE WHEN h.hsa_cash >= 2000 AND h.hsa_invested = 0 THEN 'act' ELSE 'ok' END AS status
    FROM hsa h
    UNION ALL
    SELECT 1, 'Cash', 'Rebuild the emergency buffer',
        'Liquid cash is below three months of expenses. Do not add to Active until this clears.',
        c.liquid, round(b.monthly_spend * 3), '$',
        CASE WHEN c.liquid < b.monthly_spend * 3 THEN 'act' ELSE 'ok' END
    FROM cash c CROSS JOIN burn b
    UNION ALL
    SELECT 2, 'Geography', 'Route contributions to international',
        'Active US equity is above the 55% ceiling. Correct with new contributions, never by selling.',
        bd.us_pct, bd.band_max, '%',
        CASE WHEN bd.us_pct > bd.band_max THEN 'act' ELSE 'ok' END
    FROM bands bd
    UNION ALL
    SELECT 2, 'Geography', 'International below the 45% floor',
        'Deployment rule 1: while international is under 45% of Active equity, 100% of new money goes to VXUS or VYMI.',
        bd.intl_pct, 45.0, '%',
        CASE WHEN bd.intl_pct < 45 THEN 'act' ELSE 'ok' END
    FROM bands bd
    UNION ALL
    SELECT 2, 'Positions', 'Consolidate standard positions',
        'Active is under $15K, which caps standard positions at 7. Consolidate before adding anything new.',
        p.n_standard, 7.0, ' positions',
        CASE WHEN p.active_total < 15000 AND p.n_standard > 7 THEN 'act' ELSE 'ok' END
    FROM pos p
    UNION ALL
    SELECT 2, 'Positions', 'Trim positions over their cap',
        'One or more holdings exceed the sleeve cap (7% standard, 12% conviction under $15K).',
        p.n_over_cap, 0.0, ' positions',
        CASE WHEN p.n_over_cap > 0 THEN 'act' ELSE 'ok' END
    FROM pos p
    UNION ALL
    SELECT 3, 'Sleeves', 'Defensive sleeve inside 25-35%',
        'VYMI is the defensive sleeve. Outside the band, rebalance at the quarterly review.',
        p.defensive_pct, 30.0, '%',
        CASE WHEN p.defensive_pct BETWEEN 25 AND 35 THEN 'ok' ELSE 'act' END
    FROM pos p
    UNION ALL
    SELECT 3, 'Sleeves', 'Inflation hedge inside 0-5%',
        'GLD fills this sleeve and is the only asset covering either inflationary environment.',
        p.hedge_pct, 5.0, '%',
        CASE WHEN p.hedge_pct <= 5 THEN 'ok' ELSE 'act' END
    FROM pos p
    UNION ALL
    SELECT 3, 'Sleeves', 'Dry powder inside 0-15%',
        'SPAXX. Above 15% is uninvested drag; the thesis says cash loses in the long run.',
        p.powder_pct, 15.0, '%',
        CASE WHEN p.powder_pct <= 15 THEN 'ok' ELSE 'act' END
    FROM pos p
)
SELECT
    severity, area, title, detail,
    round(current_value, 1) AS current_value,
    round(target_value, 1)  AS target_value,
    unit, status
FROM checks
ORDER BY CASE WHEN status = 'act' THEN 0 ELSE 1 END, severity, area
