-- this-month spend per category vs its trailing 3-complete-month average
WITH this_m AS (
    SELECT category_group, sum(expense_amount) AS spend
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= cast({{ dbt.date_trunc('month', today()) }} as date)
    GROUP BY 1
),
prior3 AS (
    SELECT category_group, sum(expense_amount) / 3 AS avg_spend
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= cast({{ dbt.dateadd('month', -3, dbt.date_trunc('month', today())) }} as date)
      AND txn_date <  cast({{ dbt.date_trunc('month', today()) }} as date)
    GROUP BY 1
)
SELECT
    t.category_group,
    round(t.spend)                            AS this_month,
    round(coalesce(p.avg_spend, 0))           AS avg_3mo,
    round(t.spend - coalesce(p.avg_spend, 0)) AS delta
FROM this_m t
LEFT JOIN prior3 p ON t.category_group = p.category_group
WHERE t.spend > 0
ORDER BY this_month DESC
