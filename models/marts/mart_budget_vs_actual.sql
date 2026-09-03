-- Budget target vs actual spend per Monarch category group, with DATED targets.
--
-- WHY DATES: the first version carried a single target per category and compared
-- it against a trailing average. Housing was set to 1444 (the post-move share),
-- so the tab reported rent as $156 OVER budget every day while Rafa was paying
-- exactly the $1600 he owed, because the 1444 target does not begin until
-- October. A gate that fires on a false positive gets ignored within a week and
-- then protects nothing, so targets now carry effective_from / effective_to and
-- the mart resolves whichever row is in force for the period being compared.
--
-- This generalises past the move: a raise, a cancelled subscription, or the new
-- apartment's utility split all become dated rows rather than silent edits that
-- retroactively rewrite whether last quarter was on budget.
--
-- TWO targets are emitted because they answer different questions:
--   target_current   the target in force THIS month, for month-to-date pacing
-- WHAT `status` ACTUALLY COMPARES, because it is easy to misread and was misread
-- on 2026-09-02: it measures the TRAILING 3-MONTH AVERAGE spend against the target,
-- NOT month-to-date. A category can therefore report status='over' while spend_mtd
-- is 0, which is correct for what the column means and looks broken sitting next to
-- spend_mtd in the same row. Education did exactly that on day 2 of the month.
--
-- If the question is "am I over budget THIS month", the honest test is
-- projected_month > monthly_target, not this column. scripts/morning_digest.py asks
-- it that way for exactly this reason.
--   target_trailing  the average of the targets in force across each of the
--                    trailing 3 complete months, so a target that changed inside
--                    the comparison window is not compared against months it
--                    never applied to
--
-- Actuals use trailing 3 COMPLETE months. The current month is always partial,
-- and comparing a part-month actual to a full-month target is the classic way to
-- make a budget look green on the 3rd.
WITH bounds AS (
    SELECT
        cast({{ dbt.date_trunc('month', today()) }} as date) AS month_start,
        cast({{ dbt.dateadd('month', -3, dbt.date_trunc('month', today())) }} as date) AS prior3_start
),
targets AS (
    SELECT
        category_group,
        tier,
        note,
        {{ try_cast_null('monthly_target', 'numeric') }} AS monthly_target,
        {{ try_cast_null('effective_from', 'date') }}    AS effective_from,
        -- blank effective_to means "still in force"
        coalesce({{ try_cast_null('effective_to', 'date') }}, cast('2999-12-31' as date)) AS effective_to
    FROM {{ ref('budget_targets') }}
),
-- the three complete months the comparison covers, as dates
months AS (
    SELECT cast({{ dbt.dateadd('month', -1, 'month_start') }} as date) AS mo FROM bounds
    UNION ALL SELECT cast({{ dbt.dateadd('month', -2, 'month_start') }} as date) FROM bounds
    UNION ALL SELECT cast({{ dbt.dateadd('month', -3, 'month_start') }} as date) FROM bounds
),
-- target in force for each of those months
target_by_month AS (
    SELECT m.mo, t.category_group, t.monthly_target
    FROM months m
    JOIN targets t ON m.mo >= t.effective_from AND m.mo <= t.effective_to
),
trailing_target AS (
    SELECT category_group, avg(monthly_target) AS target_trailing, count(*) AS months_covered
    FROM target_by_month GROUP BY 1
),
current_target AS (
    SELECT t.category_group, t.tier, t.note, t.monthly_target AS target_current
    FROM targets t CROSS JOIN bounds b
    WHERE b.month_start >= t.effective_from AND b.month_start <= t.effective_to
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
        {{ dbt.datediff('month_start', today(), 'day') }} + 1                            AS days_elapsed,
        {{ dbt.datediff('month_start', dbt.dateadd('month', 1, 'month_start'), 'day') }} AS days_in_month
    FROM bounds
)
SELECT
    c.category_group,
    c.tier,
    c.note,
    round(c.target_current)                                       AS monthly_target,
    round(coalesce(tt.target_trailing, c.target_current))         AS target_trailing,
    -- true when the target changed inside the comparison window, so the UI can say
    -- so instead of presenting a blended number as if it were a stable budget
    coalesce(tt.target_trailing, c.target_current) <> c.target_current AS target_changed,
    round(coalesce(m.spend, 0))                                   AS spend_mtd,
    round(coalesce(p.avg_spend, 0))                               AS avg_3mo,
    round(coalesce(p.avg_spend, 0) - coalesce(tt.target_trailing, c.target_current)) AS gap_vs_target,
    e.days_elapsed,
    e.days_in_month,
    round(100.0 * e.days_elapsed / e.days_in_month)                AS mtd_pct_of_month,
    -- Pace only makes sense for spending spread through the month. Rent is one
    -- lump on the 1st, and pacing it by elapsed days claimed a $1,600 rent was
    -- becoming $2,480 by the 20th.
    CASE
        WHEN c.tier = 'fixed' THEN NULL
        ELSE round(coalesce(m.spend, 0) * e.days_in_month / nullif(e.days_elapsed, 0))
    END AS projected_month,
    CASE
        WHEN coalesce(p.avg_spend, 0) <= coalesce(tt.target_trailing, c.target_current) THEN 'on_target'
        WHEN coalesce(p.avg_spend, 0) <= coalesce(tt.target_trailing, c.target_current) * 1.25 THEN 'over'
        ELSE 'well_over'
    END AS status
FROM current_target c
LEFT JOIN trailing_target tt ON tt.category_group = c.category_group
LEFT JOIN mtd    m ON m.category_group = c.category_group
LEFT JOIN prior3 p ON p.category_group = c.category_group
CROSS JOIN elapsed e
ORDER BY coalesce(p.avg_spend, 0) - coalesce(tt.target_trailing, c.target_current) DESC
