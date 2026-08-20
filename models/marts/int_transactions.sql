{{ config(materialized='ephemeral') }}
SELECT
    t.transaction_id,
    t.txn_date,
    t.amount,
    coalesce(c.group_type, 'uncategorized')      AS group_type,
    coalesce(c.category_group, 'Uncategorized')  AS category_group,
    t.category,
    t.merchant,
    t.account,
    -- Sum the SIGNED amount within each group rather than filtering by sign.
    -- The previous version counted only negative expense rows and only positive
    -- income rows, which silently dropped:
    --   refunds and returns  (positive rows in an expense category) -> spend overstated
    --   payouts and reversals (negative rows in an income category) -> income overstated
    -- A single XOM merger in July 2026 posted -524.13 and +527.24 in an income
    -- category; dropping the negative leg overstated that month's income by $524
    -- and put this dashboard permanently out of agreement with Monarch, which sums
    -- signed amounts. Matching Monarch is the point: two numbers for one month is
    -- worse than either number alone.
    CASE WHEN c.group_type = 'expense' THEN -t.amount ELSE 0 END AS expense_amount,
    CASE WHEN c.group_type = 'income'  THEN  t.amount ELSE 0 END AS income_amount,
    CASE WHEN t.category = 'Axtria Paycheck' AND t.amount > 0 THEN t.amount ELSE 0 END AS w2_income
FROM {{ ref('stg_transactions') }} t
LEFT JOIN {{ ref('stg_categories') }} c ON t.category_id = c.category_id
WHERE NOT t.hide_from_reports
  AND coalesce(c.group_type, '') != 'transfer'
