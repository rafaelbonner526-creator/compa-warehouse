-- last ~180 days per FRED series, for sparkline charts
SELECT series, obs_date, round(value, 2) AS value
FROM {{ ref('stg_fred') }}
WHERE value IS NOT NULL
  AND obs_date >= cast({{ dbt.dateadd('day', -180, today()) }} as date)
ORDER BY series, obs_date
