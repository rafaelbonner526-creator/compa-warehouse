SELECT snapshot_date, round(net_worth) AS net_worth
FROM {{ ref('stg_networth') }}
ORDER BY snapshot_date
