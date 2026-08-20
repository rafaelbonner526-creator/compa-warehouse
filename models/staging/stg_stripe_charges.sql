-- Stripe amounts arrive in the currency's smallest unit (cents for USD), so every
-- amount is divided by 100 exactly once, here, and never again downstream.
SELECT
    id                                              AS charge_id,
    {{ try_cast_null('amount', 'numeric') }} / 100.0          AS amount,
    {{ try_cast_null('amount_refunded', 'numeric') }} / 100.0 AS amount_refunded,
    currency,
    cast({{ dbt.dateadd('second', "cast(" ~ try_cast_null('created', 'bigint') ~ " as bigint)", "cast('1970-01-01' as timestamp)") }} as date) AS created_date,
    status,
    lower(paid) = 'true'      AS paid,
    lower(refunded) = 'true'  AS refunded,
    description,
    customer                  AS customer_id,
    invoice                   AS invoice_id,
    lower(livemode) = 'true'  AS livemode
FROM {{ source('bronze', 'stripe_charges') }}
