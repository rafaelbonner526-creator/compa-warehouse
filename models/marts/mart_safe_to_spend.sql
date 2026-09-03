-- Month position against the budget: what is left, and what the month is on pace
-- to save.
--
-- REPLACED MODEL: this previously computed a living budget as 70% of trailing W2
-- take-home, from a paycheck-allocation rule that predates rent. It reported a
-- ~$3,365 target against ~$5,471 of actual spend every single month. A budget
-- that is always wrong by $2,000 trains you to ignore it.
--
-- The target now comes from seeds/budget_targets.csv (the same source the Budget
-- tab shows line by line), so the headline number and the table can never
-- disagree.
--
-- Income is ALL income over trailing 3 complete months, not just W2. Freelance is
-- lumpy but it is real, and excluding it understated capacity.
WITH monthly AS (
    SELECT
        {{ dbt.date_trunc('month', 'txn_date') }} AS mo,
        sum(income_amount)  AS income,
        sum(w2_income)      AS w2,
        sum(expense_amount) AS spend
    FROM {{ ref('int_transactions') }}
    GROUP BY 1
),
complete AS (
    SELECT income, w2, spend FROM monthly
    WHERE mo < {{ dbt.date_trunc('month', today()) }}
    ORDER BY mo DESC
    LIMIT 3
),
avgs AS (
    SELECT
        coalesce(avg(income), 0) AS avg_income,
        coalesce(avg(w2), 0)     AS avg_w2,
        coalesce(avg(spend), 0)  AS avg_spend
    FROM complete
),
-- Targets carry effective_from / effective_to because they change: the lease moved
-- from 1600 to a 2081 September stub to 1444 ongoing. Summing every row counted all
-- THREE Housing entries, making total_target 7549 against 5706 of average income and
-- producing a target savings rate of MINUS 32 percent, which the morning brief
-- printed as "ahead of your -32% target".
--
-- mart_budget_vs_actual already filtered on effective dates. This model did not.
-- Fixed 2026-09-02.
targets AS (
    SELECT
        sum(monthly_target)                                              AS total_target,
        sum(CASE WHEN tier = 'flexible' THEN monthly_target ELSE 0 END)  AS flexible_target
    FROM {{ ref('budget_targets') }}
    WHERE cast({{ try_cast_null('effective_from', 'date') }} as date) <= cast({{ today() }} as date)
      AND coalesce(cast({{ try_cast_null('effective_to', 'date') }} as date),
                   cast('2999-12-31' as date)) >= cast({{ today() }} as date)
),
this_month AS (
    SELECT
        coalesce(sum(expense_amount), 0) AS spent_mtd,
        coalesce(sum(income_amount), 0)  AS income_mtd
    FROM {{ ref('int_transactions') }}
    WHERE txn_date >= cast({{ dbt.date_trunc('month', today()) }} as date)
),
flex_mtd AS (
    SELECT coalesce(sum(i.expense_amount), 0) AS flex_spent_mtd
    FROM {{ ref('int_transactions') }} i
    -- Same effective-date filter. Without it a category with several target rows
    -- joins once per row and multiplies its own spend.
    JOIN {{ ref('budget_targets') }} b ON b.category_group = i.category_group
    WHERE i.txn_date >= cast({{ dbt.date_trunc('month', today()) }} as date)
      AND b.tier = 'flexible'
      AND cast({{ try_cast_null('b.effective_from', 'date') }} as date) <= cast({{ today() }} as date)
      AND coalesce(cast({{ try_cast_null('b.effective_to', 'date') }} as date),
                   cast('2999-12-31' as date)) >= cast({{ today() }} as date)
)
SELECT
    round(a.avg_income)                              AS avg_monthly_income,
    round(a.avg_w2)                                  AS avg_monthly_w2,
    round(a.avg_spend)                               AS avg_monthly_spend,
    t.total_target,
    t.flexible_target,
    round(m.spent_mtd)                               AS spent_this_month,
    round(m.income_mtd)                              AS income_this_month,
    round(f.flex_spent_mtd)                          AS flexible_spent_this_month,
    round(t.flexible_target - f.flex_spent_mtd)      AS flexible_left,
    round(a.avg_income - t.total_target)             AS target_monthly_savings,
    round(100 * (a.avg_income - t.total_target) / nullif(a.avg_income, 0)) AS target_savings_rate_pct,
    round(100 * (a.avg_income - a.avg_spend) / nullif(a.avg_income, 0))    AS actual_savings_rate_pct
FROM avgs a CROSS JOIN targets t CROSS JOIN this_month m CROSS JOIN flex_mtd f
