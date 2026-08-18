SELECT
    {{ try_cast_null('date', 'date') }}      AS due_date,
    {{ try_cast_null('amount', 'numeric') }} AS amount,
    stream__frequency                        AS frequency,
    stream__merchant__name                   AS merchant,
    category__name                           AS category,
    account__display_name                    AS account
FROM {{ source('bronze', 'mm_recurring') }}
