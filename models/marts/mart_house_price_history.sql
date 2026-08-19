-- Case-Shiller US national home price index, full pulled window (~20 years).
-- Feeds the 18-year property-cycle chart. Kept as its own mart because
-- mart_macro_history is capped at 180 days for sparklines, and the property cycle
-- needs decades.
SELECT obs_date, round(value, 1) AS value
FROM {{ ref('stg_fred') }}
WHERE series = 'house_prices' AND value IS NOT NULL
ORDER BY obs_date
