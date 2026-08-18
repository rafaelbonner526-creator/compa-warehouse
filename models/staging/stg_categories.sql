SELECT
    id           AS category_id,
    name         AS category,
    group__name  AS category_group,
    group__type  AS group_type   -- 'income' | 'expense' | 'transfer'
FROM {{ source('bronze', 'mm_categories') }}
