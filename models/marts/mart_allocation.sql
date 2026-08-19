-- geographic split among equity holdings (target: US 50-65%, Intl 35-50%)
WITH eq AS (
    SELECT region, market_value FROM {{ ref('stg_holdings') }} WHERE asset_class = 'equity'
),
tot AS (SELECT sum(market_value) AS t FROM eq)
SELECT
    eq.region,
    round(sum(eq.market_value))               AS value,
    round(100 * sum(eq.market_value) / t.t, 1) AS pct
FROM eq, tot t
GROUP BY eq.region, t.t
ORDER BY value DESC
