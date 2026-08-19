-- top merchants by spend, last 30 days
SELECT
    merchant,
    round(sum(expense_amount)) AS spend,
    count(*)                   AS txns
FROM {{ ref('int_transactions') }}
WHERE expense_amount > 0
  AND merchant IS NOT NULL
  AND txn_date >= cast({{ dbt.dateadd('day', -30, today()) }} as date)
GROUP BY 1
ORDER BY spend DESC
LIMIT 8
