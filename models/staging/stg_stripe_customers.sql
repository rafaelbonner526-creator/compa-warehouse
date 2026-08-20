SELECT
    id                        AS customer_id,
    email,
    name,
    cast({{ dbt.dateadd('second', "cast(" ~ try_cast_null('created', 'bigint') ~ " as bigint)", "cast('1970-01-01' as timestamp)") }} as date) AS created_date,
    lower(livemode) = 'true'  AS livemode
FROM {{ source('bronze', 'stripe_customers') }}
