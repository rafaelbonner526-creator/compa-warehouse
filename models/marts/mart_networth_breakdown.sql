-- net worth split into Cash / Investments / Debt buckets
SELECT
    CASE
        WHEN account_type IN ('Credit Cards', 'Loans') THEN 'Debt'
        WHEN account_type = 'Cash'        THEN 'Cash'
        WHEN account_type = 'Investments' THEN 'Investments'
        ELSE account_type
    END                          AS bucket,
    round(sum(current_balance))  AS balance
FROM {{ ref('stg_accounts') }}
WHERE include_in_net_worth
GROUP BY 1
ORDER BY balance DESC
