-- Living budget = 70% of trailing-3-COMPLETE-month avg W2 take-home (freelance
-- is upside, excluded). "Left to spend" = budget minus spent this calendar month.
WITH monthly AS (
    SELECT
        {{ dbt.date_trunc('month', 'txn_date') }} AS mo,
        sum(w2_income)      AS w2,
        sum(expense_amount) AS spend
    FROM {{ ref('int_transactions') }}
    GROUP BY 1
),
complete AS (
    SELECT w2, spend FROM monthly
    WHERE mo < {{ dbt.date_trunc('month', today()) }}
    ORDER BY mo DESC
    LIMIT 3
),
avgs AS (
    SELECT coalesce(avg(w2), 0) AS avg_w2, coalesce(avg(spend), 0) AS avg_spend FROM complete
),
this_month AS (
    SELECT
        coalesce(sum(expense_amount), 0) AS spent_mtd,
        coalesce(sum(income_amount), 0)  AS income_mtd
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= cast({{ dbt.date_trunc('month', today()) }} as date)
)
SELECT
    round(avg_w2)                       AS avg_monthly_income,
    round(avg_spend)                    AS avg_monthly_spend,
    round(avg_w2 * 7 / 10)              AS living_target,
    round(spent_mtd)                    AS spent_this_month,
    round(income_mtd)                   AS income_this_month,
    round(avg_w2 * 7 / 10 - spent_mtd)  AS safe_to_spend_month
FROM avgs, this_month
