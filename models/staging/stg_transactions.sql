SELECT
    id                                        AS transaction_id,
    {{ try_cast_null('date', 'date') }}       AS txn_date,
    {{ try_cast_null('amount', 'numeric') }}  AS amount,   -- neg = expense, pos = income
    category__name                            AS category,
    category__id                              AS category_id,
    merchant__name                            AS merchant,
    account__display_name                     AS account,
    account__id                               AS account_id,
    lower(is_recurring) = 'true'              AS is_recurring,
    lower(pending) = 'true'                   AS pending,
    lower(hide_from_reports) = 'true'         AS hide_from_reports
FROM {{ source('bronze', 'mm_transactions') }}
