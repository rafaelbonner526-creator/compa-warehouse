SELECT
    series,
    series_id,
    {{ try_cast_null('obs_date', 'date') }}     AS obs_date,
    {{ try_cast_null('obs_value', 'numeric') }} AS value
FROM {{ source('bronze', 'fred_observations') }}
