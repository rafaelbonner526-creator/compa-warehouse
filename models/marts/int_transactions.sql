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
    CASE WHEN c.group_type = 'expense' AND t.amount < 0 THEN -t.amount ELSE 0 END AS expense_amount,
    CASE WHEN c.group_type = 'income'  AND t.amount > 0 THEN  t.amount ELSE 0 END AS income_amount
FROM {{ ref('stg_transactions') }} t
LEFT JOIN {{ ref('stg_categories') }} c ON t.category_id = c.category_id
WHERE NOT t.hide_from_reports
  AND coalesce(c.group_type, '') != 'transfer'
