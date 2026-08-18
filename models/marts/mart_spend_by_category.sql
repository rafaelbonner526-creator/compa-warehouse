SELECT
    category_group,
    {{ dbt.date_trunc('month', 'txn_date') }} AS month,
    sum(expense_amount)                       AS spend
FROM {{ ref('int_transactions') }}
WHERE expense_amount > 0
GROUP BY 1, 2
ORDER BY month DESC, spend DESC
