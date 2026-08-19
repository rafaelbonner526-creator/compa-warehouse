-- headline portfolio signals vs ALTO targets (single row)
WITH h AS (SELECT * FROM {{ ref('stg_holdings') }}),
eqtot AS (SELECT sum(market_value) AS t FROM h WHERE asset_class = 'equity'),
acttot AS (SELECT sum(market_value) AS t FROM h WHERE account LIKE 'Active Investing%'),
tot AS (SELECT sum(market_value) AS t FROM h)
SELECT
    round(100 * (SELECT sum(market_value) FROM h WHERE asset_class='equity' AND region='US')   / (SELECT t FROM eqtot), 1) AS us_equity_pct,
    round(100 * (SELECT sum(market_value) FROM h WHERE asset_class='equity' AND region='Intl') / (SELECT t FROM eqtot), 1) AS intl_equity_pct,
    round(100 * coalesce((SELECT sum(market_value) FROM h WHERE asset_class='bond'), 0)        / (SELECT t FROM tot), 1)   AS bond_pct,
    round(100 * coalesce((SELECT sum(market_value) FROM h WHERE account LIKE 'Active Investing%' AND ticker='VYMI'), 0) / (SELECT t FROM acttot), 1) AS vymi_pct_active,
    round(100 * coalesce((SELECT sum(market_value) FROM h WHERE account LIKE 'Active Investing%' AND sleeve='dry_powder'), 0) / (SELECT t FROM acttot), 1) AS dry_powder_pct,
    (SELECT count(*) FROM h WHERE account LIKE 'Active Investing%' AND sleeve='standard') AS standard_positions
FROM (SELECT 1) x
