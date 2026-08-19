-- monthly recurring outflow (subscriptions + bills, approx monthly)
SELECT
    round(sum(abs(amount))) AS monthly_recurring,
    count(*)                AS bills
FROM {{ ref('stg_recurring') }}
WHERE amount < 0
