-- Active account positions vs sleeve caps (standard <=7%, conviction <=12%)
WITH active AS (
    SELECT ticker, name, sleeve, market_value
    FROM {{ ref('stg_holdings') }}
    WHERE account LIKE 'Active Investing%'
),
tot AS (SELECT sum(market_value) AS t FROM active)
SELECT
    a.ticker, a.name, a.sleeve,
    round(a.market_value)               AS value,
    round(100 * a.market_value / t.t, 1) AS pct_of_active,
    CASE a.sleeve WHEN 'conviction' THEN 12 WHEN 'standard' THEN 7 ELSE NULL END AS cap_pct,
    CASE
        WHEN a.sleeve = 'conviction' AND 100 * a.market_value / t.t > 12 THEN true
        WHEN a.sleeve = 'standard'   AND 100 * a.market_value / t.t > 7  THEN true
        ELSE false
    END AS over_cap
FROM active a, tot t
ORDER BY value DESC
