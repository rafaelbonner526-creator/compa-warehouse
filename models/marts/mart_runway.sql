-- liquid runway = Cash-account balances / average monthly burn
WITH liquid AS (
    SELECT coalesce(sum(current_balance), 0) AS liquid_savings
    FROM {{ ref('stg_accounts') }}
    WHERE account_type = 'Cash' AND is_asset
),
burn AS (
    SELECT avg_monthly_spend AS monthly_burn FROM {{ ref('mart_safe_to_spend') }}
)
SELECT
    round(liquid_savings)                               AS liquid_savings,
    round(monthly_burn)                                AS monthly_burn,
    round(liquid_savings / nullif(monthly_burn, 0), 1) AS runway_months
FROM liquid, burn
