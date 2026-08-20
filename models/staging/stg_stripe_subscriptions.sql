SELECT
    id                        AS subscription_id,
    status,
    customer                  AS customer_id,
    cast({{ dbt.dateadd('second', "cast(" ~ try_cast_null('created', 'bigint') ~ " as bigint)", "cast('1970-01-01' as timestamp)") }} as date) AS created_date,
    lower(cancel_at_period_end) = 'true' AS cancel_at_period_end,
    lower(livemode) = 'true'  AS livemode
FROM {{ source('bronze', 'stripe_subscriptions') }}
