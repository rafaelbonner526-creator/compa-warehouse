SELECT
    entity,
    {{ try_cast_null('year', 'integer') }}  AS year,
    {{ try_cast_null('period', 'integer') }} AS period,
    series,
    {{ try_cast_null('value', 'numeric') }} AS value
FROM {{ source('bronze', 'lh_jst') }}
