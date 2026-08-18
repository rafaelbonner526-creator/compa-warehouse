SELECT
    id                                                AS account_id,
    display_name                                      AS account,
    {{ try_cast_null('current_balance', 'numeric') }} AS current_balance,
    type__display                                     AS account_type,
    lower(is_asset) = 'true'                          AS is_asset,
    lower(include_in_net_worth) = 'true'              AS include_in_net_worth,
    institution__name                                 AS institution
FROM {{ source('bronze', 'mm_accounts') }}
