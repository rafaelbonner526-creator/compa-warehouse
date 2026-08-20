-- Budget target vs actual spend per Monarch category group.
--
-- Replaces the old "safe to spend" model, which computed a living budget as 70% of
-- W2 take-home. That number came from a paycheck-allocation rule written before
-- rent existed. Rent alone is now ~30% of income, so a 70% living budget had to
-- cover rent plus everything else and reported roughly $3,365 against actual spend
-- of ~$5,471. A budget that is always wrong by $2,000 gets ignored, which is worse
-- than no budget.
--
-- Targets live in seeds/budget_targets.csv so they are versioned and reviewable
-- rather than buried in SQL. Tiers:
--   fixed      contractual, cannot change this month
--   committed  subscriptions, changeable with notice
--   flexible   discretionary, changeable today
--
-- Actuals are compared on a TRAILING 3 COMPLETE MONTHS basis as well as
-- month-to-date, because a single month is noisy and the current month is
-- always partial. Comparing a part-month actual against a full-month target is
-- the classic way to make a budget look falsely green early in the month, so
-- mtd_pct_of_month is emitted for the UI to prorate honestly.
WITH bounds AS (
    SELECT
        cast({{ dbt.date_trunc('month', today()) }} as date) AS month_start,
        cast({{ dbt.dateadd('month', -3, dbt.date_trunc('month', today())) }} as date) AS prior3_start
),
mtd AS (
    SELECT category_group, sum(expense_amount) AS spend
    FROM {{ ref('int_transactions') }}, bounds
    WHERE txn_date >= bounds.month_start
    GROUP BY 1
),
prior3 AS (
    SELECT category_group, sum(expense_amount) / 3.0 AS avg_spend
    FROM {{ ref('int_transactions') }}, bounds
    WHERE txn_date >= bounds.prior3_start AND txn_date < bounds.month_start
    GROUP BY 1
),
elapsed AS (
    SELECT
        -- today() is a dispatched macro, so it must be CALLED here rather than passed
        -- as the literal string 'today()'. DuckDB happens to have a today() function
        -- and compiled fine; BigQuery does not, and only prod failed.
        {{ dbt.datediff('month_start', today(), 'day') }} + 1                                AS days_elapsed,
        {{ dbt.datediff('month_start', dbt.dateadd('month', 1, 'month_start'), 'day') }}     AS days_in_month
    FROM bounds
)
SELECT
    t.category_group,
    t.tier,
    t.monthly_target,
    t.note,
    round(coalesce(m.spend, 0))                                    AS spend_mtd,
    round(coalesce(p.avg_spend, 0))                                AS avg_3mo,
    round(coalesce(p.avg_spend, 0) - t.monthly_target)             AS gap_vs_target,
    e.days_elapsed,
    e.days_in_month,
    round(100.0 * e.days_elapsed / e.days_in_month)                AS mtd_pct_of_month,
    -- Pace: where MTD spend lands if the rest of the month matches so far.
    -- NULL for fixed costs on purpose. Rent is one lump on the 1st, so
    -- extrapolating it by elapsed days claimed a $1,600 rent would become $2,480.
    -- Only spending that is actually spread through the month can be paced.
    CASE
        WHEN t.tier = 'fixed' THEN NULL
        ELSE round(coalesce(m.spend, 0) * e.days_in_month / nullif(e.days_elapsed, 0))
    END AS projected_month,
    CASE
        WHEN coalesce(p.avg_spend, 0) <= t.monthly_target THEN 'on_target'
        WHEN coalesce(p.avg_spend, 0) <= t.monthly_target * 1.25 THEN 'over'
        ELSE 'well_over'
    END AS status
FROM {{ ref('budget_targets') }} t
LEFT JOIN mtd    m ON m.category_group = t.category_group
LEFT JOIN prior3 p ON p.category_group = t.category_group
CROSS JOIN elapsed e
ORDER BY coalesce(p.avg_spend, 0) - t.monthly_target DESC
