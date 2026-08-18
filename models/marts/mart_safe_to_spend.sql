-- Safe-to-spend, grounded in the ALTO 70% Living bucket, rolling windows.
-- Assumptions (v1, tune later): Living ceiling = 70% of trailing-3-month avg
-- income; groceries count as flexible (all non-transfer spend counts).
WITH w90 AS (
    SELECT
        coalesce(sum(income_amount), 0)  AS income_90d,
        coalesce(sum(expense_amount), 0) AS spend_90d
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= {{ dbt.dateadd('day', -90, today()) }}
),
w30 AS (
    SELECT coalesce(sum(expense_amount), 0) AS spent_30d
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= {{ dbt.dateadd('day', -30, today()) }}
),
w7 AS (
    SELECT coalesce(sum(expense_amount), 0) AS spent_7d
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= {{ dbt.dateadd('day', -7, today()) }}
)
SELECT
    round(income_90d / 3, 2)                         AS avg_monthly_income,
    round(spend_90d / 3, 2)                          AS avg_monthly_spend,
    round(income_90d * 7 / 30, 2)                    AS living_target,      -- 70% of monthly income
    round(spent_30d, 2)                              AS spent_last_30d,
    round(spent_7d, 2)                               AS spent_last_7d,
    round(income_90d * 7 / 30 - spent_30d, 2)        AS safe_to_spend_month,
    round(income_90d * 7 / 30 / 4 - spent_7d, 2)     AS safe_to_spend_week
FROM w90, w30, w7
