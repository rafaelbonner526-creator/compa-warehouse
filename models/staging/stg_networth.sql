SELECT
    {{ try_cast_null('date', 'date') }}       AS snapshot_date,
    {{ try_cast_null('balance', 'numeric') }} AS net_worth
FROM {{ source('bronze', 'mm_networth') }}
