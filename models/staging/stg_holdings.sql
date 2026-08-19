SELECT
    h.account,
    h.ticker,
    h.name,
    coalesce(m.region, 'US')                          AS region,
    coalesce(m.asset_class, h.security_type)          AS asset_class,
    coalesce(m.sleeve, 'standard')                    AS sleeve,
    {{ try_cast_null('h.market_value', 'numeric') }}  AS market_value,
    {{ try_cast_null('h.change_pct', 'numeric') }}    AS change_pct
FROM {{ source('bronze', 'mm_holdings') }} h
LEFT JOIN {{ ref('security_map') }} m ON h.ticker = m.ticker
