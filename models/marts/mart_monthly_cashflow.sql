SELECT
    {{ dbt.date_trunc('month', 'txn_date') }}        AS month,
    round(sum(income_amount))                        AS income,
    round(sum(expense_amount))                       AS spend,
    round(sum(income_amount) - sum(expense_amount))  AS net
FROM {{ ref('int_transactions') }}
GROUP BY 1
ORDER BY 1
