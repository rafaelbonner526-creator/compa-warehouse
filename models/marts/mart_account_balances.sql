SELECT
    account,
    account_type,
    current_balance,
    is_asset,
    include_in_net_worth
FROM {{ ref('stg_accounts') }}
ORDER BY current_balance DESC
