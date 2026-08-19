SELECT
    {{ dbt.date_trunc('month', 'txn_date') }}        AS month,
    round(sum(income_amount))                        AS income,
    round(sum(w2_income))                            AS w2_income,
    round(sum(income_amount) - sum(w2_income))       AS other_income,
    round(sum(expense_amount))                       AS spend,
    round(sum(income_amount) - sum(expense_amount))  AS net,
    round(100 * (sum(income_amount) - sum(expense_amount)) / nullif(sum(income_amount), 0)) AS savings_rate_pct
FROM {{ ref('int_transactions') }}
GROUP BY 1
ORDER BY 1
